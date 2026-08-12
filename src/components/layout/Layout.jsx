import { useLocation, useOutlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from './Sidebar';
import { BeamsBackground } from '@/components/ui/beams-background';

export default function Layout() {
  const location = useLocation();
  const outlet = useOutlet();

  return (
    <>
      <BeamsBackground intensity="medium" />
      <Sidebar />
      <main className="main">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>
    </>
  );
}
