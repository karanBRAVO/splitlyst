import { Suspense } from 'react';
import NewExpenseForm from './NewExpenseForm';

export default function NewExpensePage() {
  return (
    <Suspense>
      <NewExpenseForm />
    </Suspense>
  );
}
