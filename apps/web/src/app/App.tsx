import type { ReactElement } from 'react';
import { ConfirmHost } from '../components/ConfirmHost';
import AppRoutes from '../routes/AppRoutes';

export default function App(): ReactElement {
  return (
    <>
      <AppRoutes />
      <ConfirmHost />
    </>
  );
}
