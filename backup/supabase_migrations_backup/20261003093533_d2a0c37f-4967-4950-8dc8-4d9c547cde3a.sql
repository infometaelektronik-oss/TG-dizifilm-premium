INSERT INTO public.user_roles (user_id, role) VALUES
 ('f114d378-e423-4f17-9a83-b9b809d96d6c','admin'),
 ('f114d378-e423-4f17-9a83-b9b809d96d6c','super_admin')
ON CONFLICT (user_id, role) DO NOTHING;