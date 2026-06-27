import React from 'react';
import { createRoot } from 'react-dom/client';
import BookingOS from './components/BookingOS.jsx';
import './styles.css';

function BootError({ error }) {
  return (
    <div style={{ padding: 32, maxWidth: 760, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>EC Booking OS did not load.</h1>
      <p>The local browser cache had bad prototype data. Use the reset button below, then reload.</p>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#fff', padding: 16, border: '1px solid #ddd' }}>{String(error?.message || error)}</pre>
      <button onClick={() => { localStorage.removeItem('ec-booking-os-v1'); location.reload(); }} style={{ padding: '12px 16px', borderRadius: 999, border: 0, background: '#132217', color: '#fff' }}>Reset local Booking OS data</button>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error(error);
  }
  render() {
    if (this.state.error) return <BootError error={this.state.error} />;
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BookingOS />
    </ErrorBoundary>
  </React.StrictMode>
);
