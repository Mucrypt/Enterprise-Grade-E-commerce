-- Fix email_messages table for contact form submissions
-- Migration: 018_fix_email_messages_contact_form.sql

-- Add metadata column for storing additional info
ALTER TABLE email_messages 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Drop the existing email_type constraint and add 'contact_form'
ALTER TABLE email_messages 
DROP CONSTRAINT IF EXISTS email_messages_email_type_check;

ALTER TABLE email_messages 
ADD CONSTRAINT email_messages_email_type_check 
CHECK (email_type IN (
    'order_confirmation', 
    'order_status', 
    'shipping_update', 
    'delivery_confirmation', 
    'welcome',
    'password_reset',
    'verification',
    'promotional',
    'custom',
    'contact_form'
));

-- Add index for contact form queries
CREATE INDEX IF NOT EXISTS idx_email_messages_contact_form 
ON email_messages (email_type) 
WHERE email_type = 'contact_form';
