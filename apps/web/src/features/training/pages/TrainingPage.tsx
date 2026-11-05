import ClientTraining from './ClientTraining';
import TrainingHub from './TrainingHub';
import '../training.css';

/** Entry point: reusable routines, or one client's training workspace. */
export default function TrainingPage({ clientId }: { clientId?: string }) {
  return (
    <div className="training-page">
      {clientId ? <ClientTraining clientId={clientId} /> : <TrainingHub />}
    </div>
  );
}
