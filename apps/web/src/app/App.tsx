import type { ReactElement } from 'react';
import AppRoutes from '../routes/AppRoutes';
import '../shared/ThemeToggle';
import './App.css';

export default function App(): ReactElement {
  return <AppRoutes />;
}
