# ProjectAmol
https://vercel.com/new/amol007689s-projects/success?developer-id=&external-id=&redirect-url=&branch=main&deploymentUrl=nextjs-e4rp2b15k-amol007689s-projects.vercel.app&projectName=nextjs&s=https%3A%2F%2Fgithub.com%2Fvercel%2Fvercel%2Ftree%2Fmain%2Fexamples%2Fnextjs&gitOrgLimit=&hasTrialAvailable=&totalProjects=&cloned-from=vercel%2Fvercel%2Fexamples%2Fnextjs&flow-id=Jpc9Ed8CyZ1ixpwvZX6Ki
RLS Guard Dog: Project Setup Guide
This guide will walk you through setting up the Supabase backend, Next.js frontend, and the serverless Edge Function to connect them all.

Part 1: Supabase Project Setup
Create a Supabase Project:

Go to supabase.com and create a new project.

Save your Project URL and anon public key. You will need these for the Next.js app.

Also, save the service_role secret key. This is for the Edge Function. Find these in Project Settings > API.

Run the SQL Script:

In the Supabase dashboard, navigate to the SQL Editor.

Click + New query.

Copy the entire content of the 1-supabase_setup.sql file and paste it into the editor.

Click RUN. This will create all your tables and security policies.

Create Test Users:

Go to Authentication > Users and click + Add user.

Create at least three users:

A student (e.g., student@test.com)

A teacher (e.g., teacher@test.com)

A head teacher (e.g., headteacher@test.com)

After creating them, go to Table Editor > profiles table. Manually add a row for each user you created.

Copy the UUID for each user from the auth.users table.

Set their full_name, role (student, teacher, or head_teacher), and school_id (you can use 1 if you used the seed data).

Part 2: Next.js Frontend Setup
Create a Next.js App:

npx create-next-app@latest rls-guard-dog-app

Install Supabase JS Client:

cd rls-guard-dog-app
npm install @supabase/supabase-js

Create Environment Variables File:

In the root of your rls-guard-dog-app folder, create a file named .env.local.

Add your Supabase project keys to this file:

NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_PUBLIC_KEY

Create the Teacher Page:

Create a new file at pages/teacher.js (or app/teacher/page.jsx if using the App Router).

Copy the content of 2-TeacherDashboard.jsx into this file.

This page is now protected. If you visit /teacher without being logged in (as a user with the 'teacher' role), you will see an error message.

Run the App:

npm run dev

You can now test the teacher dashboard by logging in with the teacher account you created.

Part 3: MongoDB Setup
Create a MongoDB Atlas Account:

Go to mongodb.com/atlas and create a free cluster.

Follow the instructions to create a database user and allow access from anywhere (IP address 0.0.0.0/0) for testing purposes.

Get your Connection String. It will look something like mongodb+srv://<user>:<password>@cluster....

Part 4: Supabase Edge Function Deployment
Install the Supabase CLI:

Follow the official guide: https://supabase.com/docs/guides/cli

Link Your Project:

In your local terminal, run supabase login.

Navigate to your Next.js app's folder (or a new folder for your functions) and run supabase link --project-ref <your-project-ref>. Your project ref is in your Supabase project's URL.

Create the Edge Function:

Run the command: supabase functions new calculate-averages

This creates a folder supabase/functions/calculate-averages.

Replace the contents of the generated index.ts file with the code from 3-edge_function.ts.

Set Secrets:

Your function needs the MongoDB connection string and your Supabase service key. Set them as secrets so they are not hardcoded.

supabase secrets set MONGO_DB_URI="YOUR_MONGO_CONNECTION_STRING"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"

Note: Make sure to enclose your connection string in quotes.

Deploy the Function:

supabase functions deploy

After deployment, you can invoke the function from the Supabase dashboard or via its URL to test it. It will read from your Postgres tables and write the calculated averages to your MongoDB database.
