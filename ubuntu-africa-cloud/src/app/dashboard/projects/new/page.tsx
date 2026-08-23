import { SITE_TEMPLATES } from '@/lib/site-templates';
import ProjectBuilderForm from './project-builder-form';
export default function NewProjectPage(){return <main className='mx-auto max-w-5xl px-6 py-12'><h1 className='text-3xl font-bold'>Create a managed website</h1><p className='mt-2 text-slate-600'>Choose an approved template, enter your content and preview before submission.</p><ProjectBuilderForm templates={SITE_TEMPLATES}/></main>}
