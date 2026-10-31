'use server';
import { revalidatePath } from 'next/cache'; import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server'; import { createProjectSchema } from '@/lib/validation/project'; import { getTemplate } from '@/lib/site-templates';
export async function createProjectAction(input:unknown){
 const parsed=createProjectSchema.safeParse(input); if(!parsed.success) return {ok:false,message:'Please correct the website details.'};
 if(!getTemplate(parsed.data.templateKey)) return {ok:false,message:'Invalid website template.'};
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) return {ok:false,message:'You must be signed in.'};
 const {data:memberships}=await supabase.from('tenant_members').select('tenant_id,role').eq('user_id',user.id).in('role',['tenant_owner','tenant_admin']).limit(1);
 if(!memberships?.length) return {ok:false,message:'You do not have permission to create websites.'};
 const {data:project,error}=await supabase.from('projects').insert({tenant_id:memberships[0].tenant_id,name:parsed.data.name,slug:parsed.data.slug,template_key:parsed.data.templateKey,content:parsed.data.content,status:'draft'}).select('id').single();
 if(error||!project) return {ok:false,message:error?.message??'Could not create the website.'};
 revalidatePath('/dashboard/projects'); redirect(`/dashboard/projects/${project.id}`);
}
