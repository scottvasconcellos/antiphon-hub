import clsx from 'clsx';

export interface SidebarItem {
  id: string;
  label: string;
}

export interface SidebarProps {
  items: SidebarItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export const Sidebar = ({ items, activeId, onSelect }: SidebarProps) => (
  <nav className="a-sidebar" aria-label="Hub navigation">
    <ul className="a-sidebar__list">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className={clsx('a-sidebar__item', item.id === activeId && 'a-sidebar__item--active')}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  </nav>
);
