import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Lebo & Jabu | KORA KIDS',
  description: "Africa's stories for the world's children — an original KORA KIDS adventure series."
};

export default function LeboJabu() {
  redirect('/lebo-jabu/index.html');
}
