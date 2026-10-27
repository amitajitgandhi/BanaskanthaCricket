# Banaskantha Yuvak Mandal Cricket Tournament

Official tournament website for Banaskantha Yuvak Mandal. This repository contains public rules, schedule, player registration, player roster, auction rules, and an administrator dashboard.

## Deployment

This project uses Vercel static pages and serverless functions, with Supabase for registration persistence and file storage.

## Before launch

Review `lib/config.js` for tournament dates, venue, registration deadline, fee, and organizer contact. Configure Supabase environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and secure admin credentials in Vercel.

Confirm that the configured Supabase project is dedicated to this tournament before changing tables, storage buckets, or running `supabase/setup.sql`. Do not run the setup script on a project that contains data for another event.
