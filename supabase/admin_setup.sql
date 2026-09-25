-- Create the admin account:
--  1. Sign up normally on the site with the admin email (any role), and confirm
--     the email link (or run the confirm line below).
--  2. Run this in the SQL Editor. Direct SQL is not subject to the "users can't
--     change their own role" trigger, so this is the only way to make an admin.

-- update auth.users set email_confirmed_at = now() where email = 'letstalk@reachupmedia.in';
update public.profiles set role = 'ADMIN', verified = true, verification_status = 'VERIFIED'
where id = (select id from auth.users where email = 'letstalk@reachupmedia.in');
