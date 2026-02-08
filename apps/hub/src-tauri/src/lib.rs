use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::Instant,
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::Utc;
use directories::{BaseDirs, ProjectDirs, UserDirs};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use futures_util::StreamExt;
use keyring::Entry;
use reqwest::Client;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, State};
use thiserror::Error;
use tokio::io::AsyncWriteExt;
use tracing::{error, info};
use zip::ZipArchive;

const KEYCHAIN_SERVICE: &str = "com.antiphon.hub";

#[derive(Clone)]
struct AppState {
    db_path: PathBuf,
    logs_dir: PathBuf,
    downloads_dir: PathBuf,
    installs_dir: PathBuf,
    licenses_dir: PathBuf,
}

#[derive(Debug, Error)]
enum HubError {
    #[error("{0}")]
    Message(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Sql(#[from] rusqlite::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Request(#[from] reqwest::Error),
}

impl HubError {
    fn with_code(code: &str, message: &str) -> Self {
        Self::Message(format!("{}: {}", code, message))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HubSettings {
    download_location: Option<String>,
    ui_sounds_enabled: bool,
    auto_update_checks: bool,
}

impl Default for HubSettings {
    fn default() -> Self {
        Self {
            download_location: None,
            ui_sounds_enabled: false,
            auto_update_checks: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstalledProductRecord {
    product_id: String,
    installed_version: String,
    installed_at: String,
    install_location: String,
    installer_type: String,
    channel: String,
    last_launched_at: Option<String>,
    last_verified_at: Option<String>,
    integrity_state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HubBootstrap {
    registry: Vec<InstalledProductRecord>,
    settings: HubSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlatformInfo {
    os: String,
    arch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReleaseArtifact {
    os: String,
    arch: String,
    installer_type: String,
    install_strategy: Value,
    url: String,
    sha256: String,
    size_bytes: u64,
    signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DownloadInstallRequest {
    job_id: String,
    product_id: String,
    version: String,
    artifact: ReleaseArtifact,
    manifest_signature: Option<String>,
    manifest_payload: String,
    public_key_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LicenseFile {
    product_id: String,
    entitlements: Vec<String>,
    issued_at: String,
    expiry: Option<String>,
    signature: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgressEvent {
    job_id: String,
    product_id: String,
    state: String,
    downloaded_bytes: Option<u64>,
    total_bytes: Option<u64>,
    speed_bps: Option<f64>,
    error_code: Option<String>,
    message: Option<String>,
}

fn emit_progress(app: &AppHandle, event: DownloadProgressEvent) {
    let _ = app.emit("download-progress", event);
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn default_dirs() -> Result<AppState, HubError> {
    let project_dirs = ProjectDirs::from("com", "Antiphon", "Hub")
        .ok_or_else(|| HubError::with_code("PATHS_UNAVAILABLE", "Could not resolve project dirs"))?;

    let data_dir = project_dirs.data_dir().to_path_buf();
    let logs_dir = project_dirs.data_local_dir().join("logs");
    let downloads_dir = data_dir.join("downloads");
    let installs_dir = data_dir.join("apps");

    let licenses_dir = if cfg!(target_os = "macos") {
        let home = BaseDirs::new()
            .ok_or_else(|| HubError::with_code("PATHS_UNAVAILABLE", "Could not resolve home directory"))?
            .home_dir()
            .to_path_buf();
        home.join("Library/Application Support/Antiphon/licenses")
    } else if cfg!(target_os = "windows") {
        let app_data = std::env::var("APPDATA")
            .map(PathBuf::from)
            .map_err(|_| HubError::with_code("PATHS_UNAVAILABLE", "Could not resolve APPDATA"))?;
        app_data.join("Antiphon/licenses")
    } else {
        let home = BaseDirs::new()
            .ok_or_else(|| HubError::with_code("PATHS_UNAVAILABLE", "Could not resolve home directory"))?
            .home_dir()
            .to_path_buf();
        home.join(".config/Antiphon/licenses")
    };

    fs::create_dir_all(&data_dir)?;
    fs::create_dir_all(&logs_dir)?;
    fs::create_dir_all(&downloads_dir)?;
    fs::create_dir_all(&installs_dir)?;
    fs::create_dir_all(&licenses_dir)?;

    Ok(AppState {
        db_path: data_dir.join("hub.sqlite"),
        logs_dir,
        downloads_dir,
        installs_dir,
        licenses_dir,
    })
}

fn init_logging(logs_dir: &Path) -> Result<(), HubError> {
    fs::create_dir_all(logs_dir)?;
    let file_appender = tracing_appender::rolling::daily(logs_dir, "hub.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    let subscriber = tracing_subscriber::fmt()
        .with_writer(non_blocking)
        .with_ansi(false)
        .with_target(false)
        .finish();

    let _ = tracing::subscriber::set_global_default(subscriber);
    Ok(())
}

fn open_db(path: &Path) -> Result<Connection, HubError> {
    let connection = Connection::open(path)?;

    connection.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS installed_products (
          product_id TEXT PRIMARY KEY,
          installed_version TEXT NOT NULL,
          installed_at TEXT NOT NULL,
          install_location TEXT NOT NULL,
          installer_type TEXT NOT NULL,
          channel TEXT NOT NULL,
          last_launched_at TEXT,
          last_verified_at TEXT,
          integrity_state TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        ",
    )?;

    Ok(connection)
}

fn load_settings(db_path: &Path) -> Result<HubSettings, HubError> {
    let connection = open_db(db_path)?;
    let mut statement = connection.prepare("SELECT value FROM settings WHERE key = 'hub_settings'")?;
    let value: Result<String, _> = statement.query_row([], |row| row.get(0));

    match value {
        Ok(content) => Ok(serde_json::from_str::<HubSettings>(&content).unwrap_or_default()),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(HubSettings::default()),
        Err(error) => Err(HubError::Sql(error)),
    }
}

fn save_settings_internal(db_path: &Path, settings: &HubSettings) -> Result<(), HubError> {
    let connection = open_db(db_path)?;
    connection.execute(
        "INSERT INTO settings (key, value) VALUES ('hub_settings', ?1)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [serde_json::to_string(settings)?],
    )?;

    Ok(())
}

fn load_registry(db_path: &Path) -> Result<Vec<InstalledProductRecord>, HubError> {
    let connection = open_db(db_path)?;
    let mut statement = connection.prepare(
        "SELECT product_id, installed_version, installed_at, install_location, installer_type, channel, last_launched_at, last_verified_at, integrity_state
         FROM installed_products
         ORDER BY installed_at DESC",
    )?;

    let rows = statement.query_map([], |row| {
        Ok(InstalledProductRecord {
            product_id: row.get(0)?,
            installed_version: row.get(1)?,
            installed_at: row.get(2)?,
            install_location: row.get(3)?,
            installer_type: row.get(4)?,
            channel: row.get(5)?,
            last_launched_at: row.get(6)?,
            last_verified_at: row.get(7)?,
            integrity_state: row.get(8)?,
        })
    })?;

    let mut records = Vec::new();
    for row in rows {
        records.push(row?);
    }

    Ok(records)
}

fn upsert_registry_record(db_path: &Path, record: &InstalledProductRecord) -> Result<(), HubError> {
    let connection = open_db(db_path)?;
    connection.execute(
        "INSERT INTO installed_products (
          product_id, installed_version, installed_at, install_location, installer_type, channel, last_launched_at, last_verified_at, integrity_state
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ON CONFLICT(product_id) DO UPDATE SET
          installed_version = excluded.installed_version,
          installed_at = excluded.installed_at,
          install_location = excluded.install_location,
          installer_type = excluded.installer_type,
          channel = excluded.channel,
          last_launched_at = excluded.last_launched_at,
          last_verified_at = excluded.last_verified_at,
          integrity_state = excluded.integrity_state",
        params![
            record.product_id,
            record.installed_version,
            record.installed_at,
            record.install_location,
            record.installer_type,
            record.channel,
            record.last_launched_at,
            record.last_verified_at,
            record.integrity_state,
        ],
    )?;

    Ok(())
}

fn remove_registry_record(db_path: &Path, product_id: &str) -> Result<(), HubError> {
    let connection = open_db(db_path)?;
    connection.execute("DELETE FROM installed_products WHERE product_id = ?1", [product_id])?;
    Ok(())
}

fn find_registry_record(db_path: &Path, product_id: &str) -> Result<Option<InstalledProductRecord>, HubError> {
    let connection = open_db(db_path)?;
    let mut statement = connection.prepare(
        "SELECT product_id, installed_version, installed_at, install_location, installer_type, channel, last_launched_at, last_verified_at, integrity_state
         FROM installed_products WHERE product_id = ?1",
    )?;

    let row = statement.query_row([product_id], |row| {
        Ok(InstalledProductRecord {
            product_id: row.get(0)?,
            installed_version: row.get(1)?,
            installed_at: row.get(2)?,
            install_location: row.get(3)?,
            installer_type: row.get(4)?,
            channel: row.get(5)?,
            last_launched_at: row.get(6)?,
            last_verified_at: row.get(7)?,
            integrity_state: row.get(8)?,
        })
    });

    match row {
        Ok(record) => Ok(Some(record)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(HubError::Sql(error)),
    }
}

fn sha256_file(path: &Path) -> Result<String, HubError> {
    let bytes = fs::read(path)?;
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    Ok(format!("{:x}", hasher.finalize()))
}

fn canonical_json(value: &Value) -> String {
    fn sort_value(value: &Value) -> Value {
        match value {
            Value::Object(map) => {
                let mut keys: Vec<String> = map.keys().cloned().collect();
                keys.sort();
                let mut sorted = Map::new();
                for key in keys {
                    if let Some(inner) = map.get(&key) {
                        sorted.insert(key, sort_value(inner));
                    }
                }
                Value::Object(sorted)
            }
            Value::Array(items) => Value::Array(items.iter().map(sort_value).collect()),
            _ => value.clone(),
        }
    }

    serde_json::to_string(&sort_value(value)).unwrap_or_else(|_| "{}".to_string())
}

fn verify_ed25519(payload: &[u8], signature_base64: &str, public_key_base64: &str) -> Result<bool, HubError> {
    let pub_key_raw = BASE64
        .decode(public_key_base64)
        .map_err(|_| HubError::with_code("SIGNATURE_INVALID", "Could not decode public key"))?;

    let signature_raw = BASE64
        .decode(signature_base64)
        .map_err(|_| HubError::with_code("SIGNATURE_INVALID", "Could not decode signature"))?;

    let verifying_key = VerifyingKey::from_bytes(
        pub_key_raw
            .as_slice()
            .try_into()
            .map_err(|_| HubError::with_code("SIGNATURE_INVALID", "Public key length is invalid"))?,
    )
    .map_err(|_| HubError::with_code("SIGNATURE_INVALID", "Public key is invalid"))?;

    let signature = Signature::from_bytes(
        signature_raw
            .as_slice()
            .try_into()
            .map_err(|_| HubError::with_code("SIGNATURE_INVALID", "Signature length is invalid"))?,
    );

    Ok(verifying_key.verify(payload, &signature).is_ok())
}

fn verify_artifact_signature(artifact: &ReleaseArtifact, public_key_base64: &str) -> Result<bool, HubError> {
    let value = serde_json::json!({
        "os": artifact.os,
        "arch": artifact.arch,
        "installerType": artifact.installer_type,
        "installStrategy": artifact.install_strategy,
        "url": artifact.url,
        "sha256": artifact.sha256,
        "sizeBytes": artifact.size_bytes,
    });

    let canonical = canonical_json(&value);
    verify_ed25519(canonical.as_bytes(), &artifact.signature, public_key_base64)
}

fn verify_manifest_signature(
    manifest_payload: &str,
    manifest_signature: &Option<String>,
    public_key_base64: &str,
) -> Result<bool, HubError> {
    let Some(signature) = manifest_signature else {
        return Ok(true);
    };

    let mut value: Value = serde_json::from_str(manifest_payload)?;
    if let Value::Object(map) = &mut value {
        map.remove("manifestSignature");
    }

    let canonical = canonical_json(&value);
    verify_ed25519(canonical.as_bytes(), signature, public_key_base64)
}

fn extract_zip(archive_path: &Path, destination: &Path) -> Result<(), HubError> {
    let file = fs::File::open(archive_path)?;
    let mut archive = ZipArchive::new(file).map_err(|error| HubError::Message(error.to_string()))?;

    for index in 0..archive.len() {
        let mut item = archive.by_index(index).map_err(|error| HubError::Message(error.to_string()))?;
        let Some(relative_path) = item.enclosed_name().map(|path| path.to_path_buf()) else {
            continue;
        };

        let output_path = destination.join(relative_path);
        if item.name().ends_with('/') {
            fs::create_dir_all(&output_path)?;
        } else {
            if let Some(parent) = output_path.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut outfile = fs::File::create(&output_path)?;
            std::io::copy(&mut item, &mut outfile)?;
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Some(mode) = item.unix_mode() {
                fs::set_permissions(&output_path, fs::Permissions::from_mode(mode))?;
            }
        }
    }

    Ok(())
}

fn resolve_install_destination(
    state: &AppState,
    product_id: &str,
    version: &str,
    strategy: &Value,
) -> Result<PathBuf, HubError> {
    let kind = strategy
        .get("kind")
        .and_then(Value::as_str)
        .ok_or_else(|| HubError::with_code("INSTALL_STRATEGY_INVALID", "Missing install strategy kind"))?;

    match kind {
        "portableZip" => {
            let root = state.installs_dir.join(product_id);
            if root.exists() {
                fs::remove_dir_all(&root)?;
            }
            let destination = root.join(version);
            fs::create_dir_all(&destination)?;
            Ok(destination)
        }
        "macAppCopy" => Err(HubError::with_code(
            "INSTALL_STRATEGY_NOT_IMPLEMENTED",
            "macOS app copy strategy placeholder is not yet implemented.",
        )),
        "windowsInstaller" => Err(HubError::with_code(
            "INSTALL_STRATEGY_NOT_IMPLEMENTED",
            "Windows installer strategy placeholder is not yet implemented.",
        )),
        "macPkg" => Err(HubError::with_code(
            "INSTALL_STRATEGY_NOT_IMPLEMENTED",
            "macOS pkg strategy placeholder is not yet implemented.",
        )),
        _ => Err(HubError::with_code(
            "INSTALL_STRATEGY_INVALID",
            "Unsupported install strategy kind.",
        )),
    }
}

#[tauri::command]
fn current_platform() -> PlatformInfo {
    let os = if cfg!(target_os = "macos") {
        "mac"
    } else if cfg!(target_os = "windows") {
        "win"
    } else {
        "linux"
    };

    let arch = if cfg!(target_arch = "aarch64") { "arm64" } else { "x64" };

    PlatformInfo {
        os: os.to_string(),
        arch: arch.to_string(),
    }
}

#[tauri::command]
fn get_hub_state(state: State<AppState>) -> Result<HubBootstrap, String> {
    let settings = load_settings(&state.db_path).map_err(|error| error.to_string())?;
    let registry = load_registry(&state.db_path).map_err(|error| error.to_string())?;
    Ok(HubBootstrap { registry, settings })
}

#[tauri::command]
fn save_settings(state: State<AppState>, settings: HubSettings) -> Result<(), String> {
    save_settings_internal(&state.db_path, &settings).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_secure_value(key: String, value: String) -> Result<(), String> {
    let entry = Entry::new(KEYCHAIN_SERVICE, &key).map_err(|error| error.to_string())?;
    entry.set_password(&value).map_err(|error| error.to_string())
}

#[tauri::command]
fn read_secure_value(key: String) -> Result<Option<String>, String> {
    let entry = Entry::new(KEYCHAIN_SERVICE, &key).map_err(|error| error.to_string())?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn write_license_file(state: State<AppState>, product_id: String, license: LicenseFile) -> Result<(), String> {
    fs::create_dir_all(&state.licenses_dir).map_err(|error| error.to_string())?;
    let destination = state.licenses_dir.join(format!("{}.license", product_id));
    let payload = serde_json::to_string_pretty(&license).map_err(|error| error.to_string())?;
    fs::write(destination, payload).map_err(|error| error.to_string())
}

#[tauri::command]
fn export_offline_activation_request(payload: String) -> Result<String, String> {
    let documents_dir = UserDirs::new()
        .and_then(|directories| directories.document_dir().map(|path| path.to_path_buf()))
        .ok_or_else(|| "Could not resolve documents directory".to_string())?;

    let folder = documents_dir.join("Antiphon");
    fs::create_dir_all(&folder).map_err(|error| error.to_string())?;

    let path = folder.join(format!(
        "offline-activation-request-{}.json",
        Utc::now().format("%Y%m%d-%H%M%S")
    ));

    fs::write(&path, payload).map_err(|error| error.to_string())?;
    Ok(path.display().to_string())
}

#[tauri::command]
fn import_offline_activation_response() -> Result<String, String> {
    let documents_dir = UserDirs::new()
        .and_then(|directories| directories.document_dir().map(|path| path.to_path_buf()))
        .ok_or_else(|| "Could not resolve documents directory".to_string())?;

    let folder = documents_dir.join("Antiphon");
    let entries = fs::read_dir(folder).map_err(|error| error.to_string())?;

    let mut newest: Option<(std::time::SystemTime, PathBuf)> = None;

    for entry in entries.flatten() {
        let path = entry.path();
        let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };

        if !file_name.starts_with("offline-activation-response-") || !file_name.ends_with(".json") {
            continue;
        }

        let modified = entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);

        match newest {
            Some((current_modified, _)) if modified <= current_modified => {}
            _ => newest = Some((modified, path)),
        }
    }

    let (_, latest_path) = newest.ok_or_else(|| {
        "No offline activation response file found. Add offline-activation-response-*.json to Documents/Antiphon.".to_string()
    })?;

    fs::read_to_string(latest_path).map_err(|error| error.to_string())
}

#[tauri::command]
fn open_logs(state: State<AppState>) -> Result<(), String> {
    open::that(&state.logs_dir).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
async fn download_and_install(
    app: AppHandle,
    state: State<'_, AppState>,
    request: DownloadInstallRequest,
) -> Result<InstalledProductRecord, String> {
    let work = async {
        info!(product_id = request.product_id, "download_and_install started");

        emit_progress(
            &app,
            DownloadProgressEvent {
                job_id: request.job_id.clone(),
                product_id: request.product_id.clone(),
                state: "queued".to_string(),
                downloaded_bytes: Some(0),
                total_bytes: Some(request.artifact.size_bytes),
                speed_bps: Some(0.0),
                error_code: None,
                message: Some("Queued".to_string()),
            },
        );

        if !verify_manifest_signature(
            &request.manifest_payload,
            &request.manifest_signature,
            &request.public_key_base64,
        )? {
            return Err(HubError::with_code(
                "MANIFEST_SIGNATURE_INVALID",
                "Manifest signature verification failed.",
            ));
        }

        if !verify_artifact_signature(&request.artifact, &request.public_key_base64)? {
            return Err(HubError::with_code(
                "ARTIFACT_SIGNATURE_INVALID",
                "Artifact signature verification failed.",
            ));
        }

        let client = Client::new();
        let response = client.get(&request.artifact.url).send().await?;
        if !response.status().is_success() {
            return Err(HubError::with_code(
                "DOWNLOAD_FAILED",
                &format!("HTTP {}", response.status()),
            ));
        }

        let total_bytes = response.content_length().unwrap_or(request.artifact.size_bytes);
        let download_name = request
            .artifact
            .url
            .rsplit('/')
            .next()
            .unwrap_or("artifact.bin")
            .to_string();

        let download_path = state
            .downloads_dir
            .join(format!("{}-{}", request.job_id, download_name));

        let mut file = tokio::fs::File::create(&download_path).await?;
        let mut downloaded: u64 = 0;
        let mut stream = response.bytes_stream();
        let started = Instant::now();

        emit_progress(
            &app,
            DownloadProgressEvent {
                job_id: request.job_id.clone(),
                product_id: request.product_id.clone(),
                state: "downloading".to_string(),
                downloaded_bytes: Some(0),
                total_bytes: Some(total_bytes),
                speed_bps: Some(0.0),
                error_code: None,
                message: Some("Downloading".to_string()),
            },
        );

        while let Some(chunk) = stream.next().await {
            let bytes = chunk?;
            file.write_all(&bytes).await?;
            downloaded += bytes.len() as u64;
            let elapsed = started.elapsed().as_secs_f64().max(0.1);
            let speed = downloaded as f64 / elapsed;

            emit_progress(
                &app,
                DownloadProgressEvent {
                    job_id: request.job_id.clone(),
                    product_id: request.product_id.clone(),
                    state: "downloading".to_string(),
                    downloaded_bytes: Some(downloaded),
                    total_bytes: Some(total_bytes),
                    speed_bps: Some(speed),
                    error_code: None,
                    message: None,
                },
            );
        }

        file.flush().await?;

        emit_progress(
            &app,
            DownloadProgressEvent {
                job_id: request.job_id.clone(),
                product_id: request.product_id.clone(),
                state: "verifying".to_string(),
                downloaded_bytes: Some(downloaded),
                total_bytes: Some(total_bytes),
                speed_bps: Some(0.0),
                error_code: None,
                message: Some("Verifying".to_string()),
            },
        );

        let digest = sha256_file(&download_path)?;
        if digest.to_lowercase() != request.artifact.sha256.to_lowercase() {
            return Err(HubError::with_code(
                "ARTIFACT_HASH_MISMATCH",
                "Downloaded artifact SHA-256 hash does not match release manifest.",
            ));
        }

        emit_progress(
            &app,
            DownloadProgressEvent {
                job_id: request.job_id.clone(),
                product_id: request.product_id.clone(),
                state: "installing".to_string(),
                downloaded_bytes: Some(downloaded),
                total_bytes: Some(total_bytes),
                speed_bps: Some(0.0),
                error_code: None,
                message: Some("Installing".to_string()),
            },
        );

        let install_root = resolve_install_destination(
            &state,
            &request.product_id,
            &request.version,
            &request.artifact.install_strategy,
        )?;

        let strategy_kind = request
            .artifact
            .install_strategy
            .get("kind")
            .and_then(Value::as_str)
            .unwrap_or("unknown");

        let install_location = if strategy_kind == "portableZip" {
            extract_zip(&download_path, &install_root)?;
            let relative = request
                .artifact
                .install_strategy
                .get("executableRelativePath")
                .and_then(Value::as_str)
                .unwrap_or("");

            install_root.join(relative)
        } else {
            install_root.clone()
        };

        if !install_location.exists() {
            return Err(HubError::with_code(
                "INSTALL_FAILED",
                "Install artifact did not produce expected location.",
            ));
        }

        let now = now_iso();
        let record = InstalledProductRecord {
            product_id: request.product_id.clone(),
            installed_version: request.version.clone(),
            installed_at: now.clone(),
            install_location: install_location.display().to_string(),
            installer_type: request.artifact.installer_type.clone(),
            channel: "stable".to_string(),
            last_launched_at: None,
            last_verified_at: Some(now),
            integrity_state: "verified".to_string(),
        };

        upsert_registry_record(&state.db_path, &record)?;

        emit_progress(
            &app,
            DownloadProgressEvent {
                job_id: request.job_id.clone(),
                product_id: request.product_id.clone(),
                state: "complete".to_string(),
                downloaded_bytes: Some(downloaded),
                total_bytes: Some(total_bytes),
                speed_bps: Some(0.0),
                error_code: None,
                message: Some("Complete".to_string()),
            },
        );

        Ok(record)
    }
    .await;

    if let Err(error) = &work {
        error!(product_id = request.product_id, "download_and_install failed: {error}");
        emit_progress(
            &app,
            DownloadProgressEvent {
                job_id: request.job_id,
                product_id: request.product_id,
                state: "error".to_string(),
                downloaded_bytes: None,
                total_bytes: None,
                speed_bps: Some(0.0),
                error_code: Some("DOWNLOAD_OR_INSTALL_FAILED".to_string()),
                message: Some(error.to_string()),
            },
        );
    }

    work.map_err(|error| error.to_string())
}

#[tauri::command]
fn uninstall_product(state: State<AppState>, product_id: String) -> Result<(), String> {
    let Some(record) = find_registry_record(&state.db_path, &product_id).map_err(|error| error.to_string())? else {
        return Ok(());
    };

    let installed_path = PathBuf::from(record.install_location);

    if record.installer_type == "zip" {
        let root = state.installs_dir.join(&product_id);
        if root.exists() {
            fs::remove_dir_all(root).map_err(|error| error.to_string())?;
        } else if installed_path.exists() {
            if installed_path.is_dir() {
                fs::remove_dir_all(installed_path).map_err(|error| error.to_string())?;
            } else {
                fs::remove_file(installed_path).map_err(|error| error.to_string())?;
            }
        }
    }

    remove_registry_record(&state.db_path, &product_id).map_err(|error| error.to_string())
}

#[tauri::command]
fn launch_product(state: State<AppState>, product_id: String) -> Result<(), String> {
    let Some(mut record) = find_registry_record(&state.db_path, &product_id).map_err(|error| error.to_string())? else {
        return Err("Product is not installed".to_string());
    };

    let location = PathBuf::from(&record.install_location);
    if !location.exists() {
        return Err("Install location no longer exists".to_string());
    }

    if cfg!(target_os = "macos") {
        if location.extension().is_some_and(|ext| ext == "app") {
            Command::new("open")
                .arg(&location)
                .spawn()
                .map_err(|error| error.to_string())?;
        } else {
            Command::new("open")
                .arg(&location)
                .spawn()
                .map_err(|error| error.to_string())?;
        }
    } else if cfg!(target_os = "windows") {
        Command::new(&location)
            .spawn()
            .map_err(|error| error.to_string())?;
    } else {
        Command::new("xdg-open")
            .arg(&location)
            .spawn()
            .map_err(|error| error.to_string())?;
    }

    record.last_launched_at = Some(now_iso());
    upsert_registry_record(&state.db_path, &record).map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
fn verify_installed_apps(state: State<AppState>) -> Result<Vec<InstalledProductRecord>, String> {
    let mut records = load_registry(&state.db_path).map_err(|error| error.to_string())?;

    for record in &mut records {
        let exists = PathBuf::from(&record.install_location).exists();
        record.last_verified_at = Some(now_iso());
        record.integrity_state = if exists { "verified" } else { "failed" }.to_string();
        upsert_registry_record(&state.db_path, record).map_err(|error| error.to_string())?;
    }

    Ok(records)
}

pub fn run() {
    let state = default_dirs().expect("Failed to initialize app directories");
    init_logging(&state.logs_dir).expect("Failed to initialize logging");
    let _ = open_db(&state.db_path).expect("Failed to initialize sqlite");

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            current_platform,
            get_hub_state,
            save_settings,
            write_secure_value,
            read_secure_value,
            write_license_file,
            export_offline_activation_request,
            import_offline_activation_response,
            open_logs,
            download_and_install,
            uninstall_product,
            launch_product,
            verify_installed_apps,
        ])
        .setup(|_| {
            info!("Antiphon Hub initialized");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
