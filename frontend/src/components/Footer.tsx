import React from 'react';

export default function Footer() {
  return (
    <footer style={{
      padding: '2rem',
      backgroundColor: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border)',
      textAlign: 'center',
      color: 'var(--text-muted)',
      fontSize: '0.9rem',
      marginTop: 'auto'
    }}>
      <p>&copy; 2026 FlowCheck Platform. All rights reserved.</p>
    </footer>
  );
}