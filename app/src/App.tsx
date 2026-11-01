import { useStore } from './store';
import { Onboarding } from './components/Onboarding';
import { Dashboard } from './components/Dashboard';

export default function App() {
  const { s, framed, toast } = useStore();
  return (
    <div className="frame-outer">
      <div
        className="frame"
        style={{
          maxWidth: framed ? 420 : '100%',
          boxShadow: framed ? '0 0 0 1px var(--field), 0 20px 60px rgba(40,30,20,0.15)' : 'none',
        }}
      >
        {s.screen === 'onboarding' ? <Onboarding /> : <Dashboard />}
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </div>
  );
}
