const serialPattern = /^[A-Z0-9-]{8,}$/i;

export const isSerialFormatValid = (serial: string): boolean => {
  return serialPattern.test(serial.trim());
};

