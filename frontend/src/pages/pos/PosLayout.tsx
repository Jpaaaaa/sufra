import { Outlet } from 'react-router-dom';
import './pos.css';

export default function PosLayout() {
  return (
    <div data-pos>
      <Outlet />
    </div>
  );
}
