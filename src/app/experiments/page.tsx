import type { Metadata } from 'next';
import ExperimentsClient from './ExperimentsClient';

export const metadata: Metadata = {
  title: 'Experiments | Canlı Maçlar',
  description: 'Deneme ve prototip algoritmalarını canlı veriyle test edin.',
};

export default function ExperimentsPage() {
  return <ExperimentsClient />;
}
