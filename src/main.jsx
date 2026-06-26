import React from 'react';
import { createRoot } from 'react-dom/client';
import BookingOS from './components/BookingOS.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BookingOS />
  </React.StrictMode>
);
