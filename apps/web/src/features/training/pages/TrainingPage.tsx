import { useLocation } from '../../../hooks/useLocation';
import ClientTraining from './ClientTraining';
import TrainingHub from './TrainingHub';
import '../training.css';

/** Entry point: the training hub (clients/templates) or one client's workspace. */
export default function TrainingPage({ clientId }: { clientId?: string }) {
  const { pathname } = useLocation();
  return (
    <div className="training-page">
      {clientId ? (
        <ClientTraining clientId={clientId} />
      ) : (
        <TrainingHub
          tab={
            pathname.startsWith('/app/entrenamiento/plantillas')
              ? 'templates'
              : 'clients'
          }
        />
      )}
    </div>
  );
}
