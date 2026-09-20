import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Tumi & Tala | KORA KIDS',
  description: 'An original KORA KIDS musical preschool adventure from Africa for the world.'
};

export default function TumiTala() {
  redirect('/tumi-tala/index.html');
}
