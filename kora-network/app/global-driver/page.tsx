import { notFound } from 'next/navigation';

/**
 * This route is intentionally unavailable.
 * KORA Stream Africa is a streaming/media platform and does not provide
 * learner-licence or driver-academy services.
 */
export default function GlobalDriverPage() {
  notFound();
}
