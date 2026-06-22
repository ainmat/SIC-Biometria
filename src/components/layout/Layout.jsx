import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { BeamsBackground } from '@/components/ui/beams-background';

export default function Layout() {
  return (
    <>
      <BeamsBackground intensity="medium" />
      <Sidebar />
      <main className="main">
        <Outlet />
      </main>
    </>
  );
}
