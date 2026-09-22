-- User region/language/currency preferences (additive, backward-compatible)
-- Powers the mobile app's region+language picker: country is the user's
-- chosen/detected region (ISO 3166-1 alpha-2), preferred_currency is what
-- prices are DISPLAYED converted to (store currency stays EUR -- see
-- services/pricing/currency-rate.service.ts), preferred_locale is the
-- app's UI language, chosen independently of country by design (a user
-- can be in Italy with preferred_locale='en').

ALTER TABLE users
ADD COLUMN IF NOT EXISTS country VARCHAR(2);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3) NOT NULL DEFAULT 'EUR';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_locale VARCHAR(5) NOT NULL DEFAULT 'en';
