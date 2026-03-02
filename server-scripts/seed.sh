#!/bin/bash
# ===========================================
# Server-side: Database Seeding Script
# ===========================================
# Run on server: ./server-scripts/seed.sh [all|brands|categories|products|collections]
# Seeds the database with sample data
# ===========================================

set -e

cd /root/Enterprise-Grade-E-commerce

# Configuration
POSTGRES_CONTAINER="techtools-postgres-prod"
DB_USER="${DB_USER:-techtools_user}"
DB_NAME="${DB_NAME:-techtools_db}"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

COMMAND="${1:-all}"

echo ""
echo "=========================================="
echo "  Database Seeding - $COMMAND"
echo "=========================================="
echo ""

# Check if postgres container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
    log_error "PostgreSQL container '$POSTGRES_CONTAINER' is not running!"
    exit 1
fi

# Function to run SQL
run_sql() {
    docker exec -i $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME "$@"
}

# Seed Brands
seed_brands() {
    log_info "Seeding brands..."
    run_sql <<'EOF'
INSERT INTO brands (name, slug, description, website_url, is_active)
SELECT * FROM (VALUES
    ('AutoTech Pro', 'autotech-pro', 'Premium automotive electronics and accessories. Known for innovative dash cams, GPS systems, and smart car gadgets with industry-leading warranties.', 'https://autotechpro.com', true),
    ('DriveMaster', 'drivemaster', 'Performance parts and accessories for enthusiasts. Specializing in air intakes, exhaust systems, and engine tuning components.', 'https://drivemastergear.com', true),
    ('LuxeRide', 'luxeride', 'Luxury car interior accessories and comfort products. Premium seat covers, organizers, and comfort-enhancing products.', 'https://luxeride.com', true),
    ('SafeGuard Auto', 'safeguard-auto', 'Leading manufacturer of automotive safety and security products. Dash cams, alarms, and monitoring systems.', 'https://safeguardauto.com', true),
    ('BrightBeam', 'brightbeam', 'Automotive lighting specialists. LED headlights, fog lights, interior lighting, and accent lights for all vehicle types.', 'https://brightbeamauto.com', true),
    ('CarCare Plus', 'carcare-plus', 'Professional grade car care and detailing products. Ceramic coatings, polishes, waxes, and cleaning supplies.', 'https://carcareplus.com', true),
    ('PowerDrive', 'powerdrive', 'Portable power solutions for vehicles. Jump starters, tire inflators, and emergency equipment.', 'https://powerdrive.com', true),
    ('SoundWave Audio', 'soundwave-audio', 'High-fidelity car audio systems and components. Speakers, amplifiers, head units, and sound deadening materials.', 'https://soundwaveaudio.com', true)
) AS v(name, slug, description, website_url, is_active)
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE slug = v.slug);
EOF
    log_success "Brands seeded!"
}

# Seed Categories
seed_categories() {
    log_info "Seeding categories..."
    run_sql <<'EOF'
INSERT INTO categories (name, slug, description, display_order, is_active)
SELECT * FROM (VALUES
    ('Audio & Entertainment', 'audio-entertainment', 'Car speakers, head units, amplifiers, and entertainment systems', 5, true),
    ('Exterior Accessories', 'exterior-accessories', 'Body kits, spoilers, mirrors, and exterior styling products', 6, true),
    ('Lighting', 'lighting', 'LED headlights, fog lights, interior lights, and accent lighting', 7, true),
    ('Cleaning & Maintenance', 'cleaning-maintenance', 'Car wash supplies, polishes, waxes, and detailing products', 8, true),
    ('Phone & GPS Mounts', 'phone-gps-mounts', 'Smartphone holders, GPS mounts, and wireless charging pads', 9, true),
    ('Performance Parts', 'performance-parts', 'Air filters, exhausts, chip tuners, and performance upgrades', 10, true),
    ('Work & Safety Gear', 'work-safety-gear', 'LED work lights, safety glasses, headlamps, and hands-free lighting solutions', 11, true),
    ('Tools & Emergency', 'tools-emergency', 'Jump starters, tire inflators, roadside emergency kits, and portable tools', 12, true),
    ('Interior Comfort', 'interior-comfort', 'Seat covers, cushions, organizers, and comfort accessories', 13, true),
    ('Safety & Security', 'safety-security', 'Dash cams, alarms, GPS trackers, and vehicle security systems', 14, true)
) AS v(name, slug, description, display_order, is_active)
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = v.slug);
EOF
    log_success "Categories seeded!"
}

# Seed Products
seed_products() {
    log_info "Seeding products..."
    run_sql <<'EOF'
-- Product 1: Car Stereo
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'CAR-AUD-001', 'Premium 7" Touchscreen Car Stereo with Apple CarPlay & Android Auto', 'premium-7inch-touchscreen-car-stereo',
    'Transform your driving experience with this premium 7-inch touchscreen car stereo. Features seamless integration with Apple CarPlay and Android Auto for hands-free navigation, calls, and music.',
    '7" HD touchscreen stereo with wireless CarPlay & Android Auto, Bluetooth 5.0, and backup camera input.',
    c.id, b.id, 249.99, 199.99, 120.00, 1.2, 'kg', true, true
FROM categories c, brands b WHERE c.slug = 'audio-entertainment' AND b.slug = 'soundwave-audio'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CAR-AUD-001');

-- Product 2: Dash Cam
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'CAR-DASH-002', '4K Dual Dash Cam with Night Vision & GPS', '4k-dual-dash-cam-night-vision-gps',
    'Protect yourself on the road with this professional-grade 4K dual dash cam system. Records both front and rear simultaneously in stunning 4K resolution.',
    'Dual 4K dash cam with Sony STARVIS night vision, GPS tracking, and 24/7 parking surveillance.',
    c.id, b.id, 189.99, 159.99, 85.00, 0.35, 'kg', true, true
FROM categories c, brands b WHERE c.slug = 'safety-security' AND b.slug = 'safeguard-auto'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CAR-DASH-002');

-- Product 3: LED Headlights
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'CAR-LED-003', 'H11 LED Headlight Bulbs 20000LM 6500K White (Pair)', 'h11-led-headlight-bulbs-20000lm',
    'Upgrade your vehicle visibility with these ultra-bright H11 LED headlight bulbs. Producing 20,000 lumens per pair with a crisp 6500K white light.',
    'H11 LED bulbs with 20000LM brightness, 6500K white light, fanless design, and 50000hr lifespan.',
    c.id, b.id, 59.99, 44.99, 18.00, 0.25, 'kg', true, false
FROM categories c, brands b WHERE c.slug = 'lighting' AND b.slug = 'brightbeam'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CAR-LED-003');

-- Product 4: Wireless Charger Mount
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'CAR-CHRG-004', 'Wireless Car Charger Mount with Auto-Clamping', 'wireless-car-charger-mount-auto-clamping',
    'The ultimate phone mount and charger combo. Auto-clamping mechanism secures your phone with one hand. Delivers 15W fast wireless charging.',
    '15W fast wireless car charger with auto-clamping, 360° rotation, and dual mounting options.',
    c.id, b.id, 49.99, 39.99, 15.00, 0.3, 'kg', true, true
FROM categories c, brands b WHERE c.slug = 'phone-gps-mounts' AND b.slug = 'autotech-pro'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CAR-CHRG-004');

-- Product 5: Heated Seat Cushion
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'CAR-SEAT-005', 'Heated & Cooled Car Seat Cushion with Massage', 'heated-cooled-car-seat-cushion-massage',
    'Experience ultimate comfort on every drive. This premium seat cushion features both heating and cooling functions with 3 intensity levels each.',
    'All-season car seat cushion with heating, cooling, massage, and premium memory foam construction.',
    c.id, b.id, 89.99, 74.99, 35.00, 1.8, 'kg', true, false
FROM categories c, brands b WHERE c.slug = 'interior-comfort' AND b.slug = 'luxeride'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CAR-SEAT-005');

-- Product 6: Tire Inflator
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'CAR-TIRE-006', 'Digital Tire Inflator Portable Air Compressor', 'digital-tire-inflator-portable-compressor',
    'Never get stranded with a flat tire again. This powerful portable air compressor inflates a standard car tire in under 5 minutes.',
    'Portable 150 PSI air compressor with digital gauge, auto-shutoff, and LED emergency light.',
    c.id, b.id, 44.99, 18.00, 0.9, 'kg', true, false
FROM categories c, brands b WHERE c.slug = 'tools-emergency' AND b.slug = 'powerdrive'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CAR-TIRE-006');

-- Product 7: Ceramic Coating
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'CAR-COAT-007', 'Ceramic Coating Spray 9H Hardness Protection', 'ceramic-coating-spray-9h-protection',
    'Professional-grade ceramic coating in an easy spray-on formula. Creates a hydrophobic barrier with 9H hardness.',
    'Professional ceramic spray coating with 9H hardness, hydrophobic protection, and 12-month durability.',
    c.id, b.id, 34.99, 29.99, 12.00, 0.5, 'kg', true, false
FROM categories c, brands b WHERE c.slug = 'cleaning-maintenance' AND b.slug = 'carcare-plus'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CAR-COAT-007');

-- Product 8: Cold Air Intake
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'CAR-PERF-008', 'Cold Air Intake Kit with High-Flow Filter', 'cold-air-intake-kit-high-flow-filter',
    'Unlock your engine true potential with this cold air intake system. High-flow washable filter increases airflow by up to 50%.',
    'Performance cold air intake with washable K&N-style filter for 10-15 HP gains.',
    c.id, b.id, 149.99, 124.99, 55.00, 3.5, 'kg', true, true
FROM categories c, brands b WHERE c.slug = 'performance-parts' AND b.slug = 'drivemaster'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CAR-PERF-008');

-- Product 9: Blind Spot Mirrors
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'CAR-MIRR-009', 'Wide Angle Blind Spot Mirror Set (2-Pack)', 'wide-angle-blind-spot-mirror-set',
    'Eliminate dangerous blind spots with these convex mirrors. 360° adjustable rotation for perfect positioning.',
    '360° adjustable blind spot mirrors with HD anti-glare glass and waterproof design.',
    c.id, b.id, 12.99, 9.99, 3.00, 0.1, 'kg', true, false
FROM categories c, brands b WHERE c.slug = 'exterior-accessories' AND b.slug = 'autotech-pro'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CAR-MIRR-009');

-- Product 10: Jump Starter
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'CAR-JUMP-010', 'Portable Jump Starter Power Bank 2000A Peak', 'portable-jump-starter-power-bank-2000a',
    'The ultimate emergency power solution. Jump starts up to 8.0L gas or 6.0L diesel engines with 2000A peak power.',
    '2000A portable jump starter with 20000mAh power bank, LED flashlight, and safety protection.',
    c.id, b.id, 99.99, 79.99, 40.00, 0.8, 'kg', true, true
FROM categories c, brands b WHERE c.slug = 'tools-emergency' AND b.slug = 'powerdrive'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CAR-JUMP-010');

-- Product 11: LED Safety Work Glasses (Like HandiBeam)
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'LED-GLASS-011', 'HandiBeam LED Safety Glasses with Built-in Lights', 'handibeam-led-safety-glasses',
    'Revolutionary hands-free lighting solution! These LED safety glasses feature ultra-bright COB LED lights built directly into the frame. Perfect for automotive work, DIY projects, camping, and emergency situations. Anti-fog lenses with UV protection. 3 brightness modes with 8+ hours battery life. Rechargeable via USB-C.',
    'Hands-free LED safety glasses with 3 brightness modes, anti-fog lenses, and 8hr battery life.',
    c.id, b.id, 34.95, 29.99, 12.00, 0.15, 'kg', true, true
FROM categories c, brands b WHERE c.slug = 'work-safety-gear' AND b.slug = 'brightbeam'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'LED-GLASS-011');

-- Product 12: LED Headlamp Rechargeable
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'LED-HEAD-012', 'Ultra Bright LED Headlamp 2000 Lumens Rechargeable', 'ultra-bright-led-headlamp-2000-lumens',
    'Illuminate any workspace with this powerful 2000 lumen LED headlamp. Features wide-angle flood beam and focused spot beam modes. IPX6 waterproof rating, adjustable headband, and 30-hour runtime on low mode. Perfect for night driving repairs, camping, and emergency situations.',
    '2000 lumen rechargeable headlamp with 5 modes, IPX6 waterproof, and 30hr battery life.',
    c.id, b.id, 29.99, 24.99, 10.00, 0.2, 'kg', true, true
FROM categories c, brands b WHERE c.slug = 'work-safety-gear' AND b.slug = 'brightbeam'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'LED-HEAD-012');

-- Product 13: Magnetic Work Light
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'LED-WORK-013', 'Magnetic LED Work Light 1500 Lumens Rechargeable', 'magnetic-led-work-light-1500-lumens',
    'The ultimate under-hood work light! Strong magnetic base attaches to any metal surface. 1500 lumens with 180° adjustable head. Built-in hook for hanging. Red flashing emergency mode. USB-C rechargeable with power bank function to charge your phone.',
    'Magnetic work light with 1500 lumens, 180° swivel, hook mount, and USB-C charging.',
    c.id, b.id, 39.99, 34.99, 14.00, 0.35, 'kg', true, false
FROM categories c, brands b WHERE c.slug = 'work-safety-gear' AND b.slug = 'brightbeam'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'LED-WORK-013');

-- Product 14: Under Car Inspection Light
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'LED-INSP-014', 'Slim LED Inspection Light for Under Car Work', 'slim-led-inspection-light-under-car',
    'Ultra-slim design fits in tight spaces. Only 8mm thick! 500 lumens with 120° wide beam angle. Strong magnetic strip runs the full length for secure mounting. Flexible body bends to fit contours. Essential tool for mechanics and DIY enthusiasts.',
    'Ultra-slim 8mm inspection light with magnetic strip and flexible body for tight spaces.',
    c.id, b.id, 24.99, 19.99, 8.00, 0.18, 'kg', true, false
FROM categories c, brands b WHERE c.slug = 'work-safety-gear' AND b.slug = 'brightbeam'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'LED-INSP-014');

-- Product 15: LED Cap Light Clip-On
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'LED-CAP-015', 'LED Cap Light Clip-On Hands-Free Work Light', 'led-cap-light-clip-on-hands-free',
    'Clip-on LED light attaches to any cap or hat brim. Provides 200 lumens of hands-free illumination. 90° tilt adjustment to direct light exactly where needed. Motion sensor on/off option. Includes 2 units per pack.',
    '200 lumen clip-on cap light with motion sensor - 2 pack included.',
    c.id, b.id, 16.99, 12.99, 5.00, 0.08, 'kg', true, false
FROM categories c, brands b WHERE c.slug = 'work-safety-gear' AND b.slug = 'brightbeam'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'LED-CAP-015');

-- Product 16: Night Driving Glasses Anti-Glare
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'GLASS-NIGHT-016', 'Night Driving Glasses with Anti-Glare Yellow Lens', 'night-driving-glasses-anti-glare',
    'Reduce headlight glare and eye strain during night driving. Yellow-tinted polarized lenses enhance contrast and depth perception. Lightweight aluminum-magnesium frame. UV400 protection. Comes with hard case and cleaning cloth.',
    'Anti-glare night driving glasses with polarized yellow lenses and UV400 protection.',
    c.id, b.id, 29.99, 24.99, 9.00, 0.1, 'kg', true, false
FROM categories c, brands b WHERE c.slug = 'safety-security' AND b.slug = 'safeguard-auto'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'GLASS-NIGHT-016');

-- Product 17: USB Rechargeable LED Flashlight
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'LED-FLASH-017', 'Tactical LED Flashlight 5000 Lumens Rechargeable', 'tactical-led-flashlight-5000-lumens',
    'Military-grade tactical flashlight with 5000 lumens output. Zoom function from wide flood to focused beam. 5 modes: High, Medium, Low, Strobe, SOS. Aircraft-grade aluminum body with IPX7 waterproof rating. USB-C rechargeable with battery indicator.',
    '5000 lumen tactical flashlight with zoom, 5 modes, and IPX7 waterproof rating.',
    c.id, b.id, 45.99, 39.99, 15.00, 0.25, 'kg', true, true
FROM categories c, brands b WHERE c.slug = 'tools-emergency' AND b.slug = 'powerdrive'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'LED-FLASH-017');

-- Product 18: Car Interior LED Strip Kit
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'LED-STRIP-018', 'Car Interior LED Strip Light Kit RGB with App Control', 'car-interior-led-strip-kit-rgb',
    'Transform your car interior with ambient lighting. 48 LED strips in 4 pieces for door, dash, and footwell. 16 million colors with app and remote control. Music sync mode pulses with your audio. DIY installation in minutes.',
    'RGB interior LED strip kit with app control, music sync, and 16 million colors.',
    c.id, b.id, 34.99, 27.99, 11.00, 0.3, 'kg', true, true
FROM categories c, brands b WHERE c.slug = 'lighting' AND b.slug = 'brightbeam'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'LED-STRIP-018');

-- Product 19: Emergency Road Flares LED
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'LED-FLARE-019', 'LED Road Flares Emergency Disc Lights 3-Pack', 'led-road-flares-emergency-disc-3pack',
    'Be seen in emergencies! These LED road flares are visible from over 1 mile away. 9 light modes including SOS and strobe. Magnetic base attaches to vehicles. Crush-proof and waterproof. Rechargeable with 20+ hour runtime per disc.',
    'LED emergency road flares 3-pack with 9 modes, magnetic base, and 1-mile visibility.',
    c.id, b.id, 39.99, 34.99, 14.00, 0.4, 'kg', true, false
FROM categories c, brands b WHERE c.slug = 'tools-emergency' AND b.slug = 'safeguard-auto'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'LED-FLARE-019');

-- Product 20: Mechanic Creeper Light
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'LED-CREEP-020', 'LED Light Bar for Mechanic Creeper 36-inch', 'led-light-bar-mechanic-creeper-36inch',
    'Attach to your creeper or workbench for brilliant under-car illumination. 36-inch LED bar with 2400 lumens. Rechargeable lithium battery lasts 6 hours on full brightness. Quick-release magnetic mounts included.',
    '36-inch LED light bar for creepers with 2400 lumens and magnetic quick-release mounts.',
    c.id, b.id, 69.99, 59.99, 25.00, 0.8, 'kg', true, false
FROM categories c, brands b WHERE c.slug = 'work-safety-gear' AND b.slug = 'brightbeam'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'LED-CREEP-020');

-- Product 21: Premium Leather Seat Covers
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'SEAT-LEATH-021', 'Premium Synthetic Leather Seat Covers Full Set', 'premium-leather-seat-covers-full-set',
    'Upgrade your interior with these premium synthetic leather seat covers. Universal fit for most cars. Waterproof backing protects original seats. Easy installation with elastic straps and hooks. Available in Black, Gray, Tan, and Red.',
    'Full set leather seat covers with waterproof backing and universal fit.',
    c.id, b.id, 129.99, 99.99, 45.00, 3.5, 'kg', true, true
FROM categories c, brands b WHERE c.slug = 'interior-comfort' AND b.slug = 'luxeride'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'SEAT-LEATH-021');

-- Product 22: Car Trunk Organizer
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'ORG-TRUNK-022', 'Collapsible Car Trunk Organizer with Cooler Compartment', 'collapsible-car-trunk-organizer-cooler',
    'Keep your trunk organized with this multi-compartment organizer. Features insulated cooler section for groceries. Collapses flat when not in use. Non-slip bottom prevents sliding. Multiple pockets for tools and accessories.',
    'Collapsible trunk organizer with insulated cooler and anti-slip base.',
    c.id, b.id, 44.99, 36.99, 16.00, 1.2, 'kg', true, false
FROM categories c, brands b WHERE c.slug = 'interior-comfort' AND b.slug = 'luxeride'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'ORG-TRUNK-022');

-- Product 23: Digital Tire Pressure Gauge
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'TOOL-GAUGE-023', 'Digital Tire Pressure Gauge with Backlit Display', 'digital-tire-pressure-gauge-backlit',
    'Professional accuracy in a compact design. Large backlit LCD display readable in any light. Measures 0-150 PSI for cars, trucks, and motorcycles. Auto-off feature saves battery. Includes ergonomic grip and protective cap.',
    'Digital tire gauge with 0-150 PSI range, backlit display, and ergonomic grip.',
    c.id, b.id, 14.99, 11.99, 4.00, 0.12, 'kg', true, false
FROM categories c, brands b WHERE c.slug = 'tools-emergency' AND b.slug = 'autotech-pro'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TOOL-GAUGE-023');

-- Product 24: OBD2 Bluetooth Scanner
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'DIAG-OBD-024', 'OBD2 Bluetooth Scanner Car Diagnostic Tool', 'obd2-bluetooth-scanner-diagnostic-tool',
    'Diagnose check engine lights instantly from your smartphone. Compatible with iOS and Android via Bluetooth. Reads and clears fault codes. Shows live engine data including RPM, speed, fuel trim, and oxygen sensors. Works with all 1996+ vehicles.',
    'Bluetooth OBD2 scanner for smartphone with live data and code reading.',
    c.id, b.id, 29.99, 24.99, 9.00, 0.08, 'kg', true, true
FROM categories c, brands b WHERE c.slug = 'tools-emergency' AND b.slug = 'autotech-pro'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'DIAG-OBD-024');

-- Product 25: Car Vacuum Cleaner Cordless
INSERT INTO products (sku, name, slug, description, short_description, category_id, brand_id, base_price, sale_price, cost_price, weight, weight_unit, is_active, is_featured)
SELECT 'CLEAN-VAC-025', 'Cordless Car Vacuum Cleaner 12000PA Powerful Suction', 'cordless-car-vacuum-cleaner-12000pa',
    'Keep your car spotless with this powerful cordless vacuum. 12000PA suction picks up dirt, crumbs, and pet hair. HEPA filter traps allergens. Includes crevice tool, brush attachment, and extension hose. 30-minute runtime on single charge.',
    'Cordless car vacuum with 12000PA suction, HEPA filter, and 30min runtime.',
    c.id, b.id, 59.99, 49.99, 22.00, 0.9, 'kg', true, true
FROM categories c, brands b WHERE c.slug = 'cleaning-maintenance' AND b.slug = 'carcare-plus'
AND NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CLEAN-VAC-025');
EOF
    log_success "Products seeded!"
}

# Seed Inventory for products
seed_inventory() {
    log_info "Seeding inventory..."
    run_sql <<'EOF'
INSERT INTO inventory (product_id, warehouse_location, current_stock, low_stock_threshold)
SELECT p.id, 'Main Warehouse', 
    CASE 
        WHEN p.sku = 'CAR-AUD-001' THEN 50
        WHEN p.sku = 'CAR-DASH-002' THEN 75
        WHEN p.sku = 'CAR-LED-003' THEN 200
        WHEN p.sku = 'CAR-CHRG-004' THEN 120
        WHEN p.sku = 'CAR-SEAT-005' THEN 60
        WHEN p.sku = 'CAR-TIRE-006' THEN 90
        WHEN p.sku = 'CAR-COAT-007' THEN 150
        WHEN p.sku = 'CAR-PERF-008' THEN 35
        WHEN p.sku = 'CAR-MIRR-009' THEN 300
        WHEN p.sku = 'CAR-JUMP-010' THEN 80
        WHEN p.sku = 'LED-GLASS-011' THEN 250
        WHEN p.sku = 'LED-HEAD-012' THEN 180
        WHEN p.sku = 'LED-WORK-013' THEN 120
        WHEN p.sku = 'LED-INSP-014' THEN 200
        WHEN p.sku = 'LED-CAP-015' THEN 350
        WHEN p.sku = 'GLASS-NIGHT-016' THEN 150
        WHEN p.sku = 'LED-FLASH-017' THEN 100
        WHEN p.sku = 'LED-STRIP-018' THEN 180
        WHEN p.sku = 'LED-FLARE-019' THEN 120
        WHEN p.sku = 'LED-CREEP-020' THEN 60
        WHEN p.sku = 'SEAT-LEATH-021' THEN 45
        WHEN p.sku = 'ORG-TRUNK-022' THEN 90
        WHEN p.sku = 'TOOL-GAUGE-023' THEN 400
        WHEN p.sku = 'DIAG-OBD-024' THEN 200
        WHEN p.sku = 'CLEAN-VAC-025' THEN 85
        ELSE 50
    END,
    CASE 
        WHEN p.sku LIKE 'LED-%' THEN 15
        ELSE 10
    END
FROM products p
WHERE p.sku IN ('CAR-AUD-001', 'CAR-DASH-002', 'CAR-LED-003', 'CAR-CHRG-004', 'CAR-SEAT-005', 
                'CAR-TIRE-006', 'CAR-COAT-007', 'CAR-PERF-008', 'CAR-MIRR-009', 'CAR-JUMP-010',
                'LED-GLASS-011', 'LED-HEAD-012', 'LED-WORK-013', 'LED-INSP-014', 'LED-CAP-015',
                'GLASS-NIGHT-016', 'LED-FLASH-017', 'LED-STRIP-018', 'LED-FLARE-019', 'LED-CREEP-020',
                'SEAT-LEATH-021', 'ORG-TRUNK-022', 'TOOL-GAUGE-023', 'DIAG-OBD-024', 'CLEAN-VAC-025')
AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.product_id = p.id);
EOF
    log_success "Inventory seeded!"
}

# Seed Product Collections
seed_collections() {
    log_info "Seeding product collections..."
    run_sql <<'EOF'
INSERT INTO product_collections (name, slug, description, short_description, is_active, is_featured, position, visibility)
SELECT * FROM (VALUES
    ('Summer Road Trip Essentials', 'summer-road-trip-essentials', 'Everything you need for the perfect summer road trip.', 'Must-have gadgets and accessories for your summer adventures.', true, true, 1, 'public'),
    ('Best Sellers', 'best-sellers', 'Our most popular products loved by thousands of customers.', 'Customer favorites and top-rated automotive accessories.', true, true, 2, 'public'),
    ('New Arrivals', 'new-arrivals', 'Check out the latest additions to our catalog.', 'The latest products just added to our store.', true, true, 3, 'public'),
    ('Budget Friendly Picks', 'budget-friendly-picks', 'Quality automotive accessories that wont break the bank.', 'Affordable accessories with excellent value for money.', true, false, 4, 'public'),
    ('Safety First Bundle', 'safety-first-bundle', 'Essential safety and security products for peace of mind.', 'Must-have safety equipment for your vehicle.', true, true, 5, 'public'),
    ('Tech Enthusiast Collection', 'tech-enthusiast-collection', 'Cutting-edge technology for the modern driver.', 'The latest tech gadgets for your connected car.', true, false, 6, 'public'),
    ('Interior Makeover', 'interior-makeover', 'Transform your car interior with premium accessories.', 'Upgrade your car interior with style and comfort.', true, false, 7, 'public'),
    ('Weekend Warrior Kit', 'weekend-warrior-kit', 'For the weekend adventurer. Off-road accessories and gear.', 'Gear up for your off-road adventures.', true, false, 8, 'public')
) AS v(name, slug, description, short_description, is_active, is_featured, position, visibility)
WHERE NOT EXISTS (SELECT 1 FROM product_collections WHERE slug = v.slug);
EOF
    log_success "Product collections seeded!"
}

# Seed Category Collections
seed_category_collections() {
    log_info "Seeding category collections..."
    run_sql <<'EOF'
INSERT INTO category_collections (name, slug, description, short_description, is_active, is_featured, position, visibility, display_order)
SELECT * FROM (VALUES
    ('Popular Categories', 'popular-categories', 'Most viewed product categories', 'Browse our most popular categories', true, true, 1, 'public', 'popular'),
    ('New Categories', 'new-categories', 'Recently added product categories', 'Explore our newest categories', true, false, 2, 'public', 'newest'),
    ('Featured Categories', 'featured-categories', 'Hand-picked category selections', 'Our top category picks', true, true, 3, 'public', 'manual'),
    ('Electronics Hub', 'electronics-hub', 'All electronics categories in one place', 'Electronic products collection', true, false, 4, 'public', 'alphabetical'),
    ('Car Accessories Collection', 'car-accessories-collection', 'Categories for car enthusiasts', 'Everything for your car', true, false, 5, 'public', 'manual')
) AS v(name, slug, description, short_description, is_active, is_featured, position, visibility, display_order)
WHERE NOT EXISTS (SELECT 1 FROM category_collections WHERE slug = v.slug);
EOF
    log_success "Category collections seeded!"
}

# Main execution
case $COMMAND in
    brands)
        seed_brands
        ;;
    categories)
        seed_categories
        ;;
    products)
        seed_products
        seed_inventory
        ;;
    collections)
        seed_collections
        seed_category_collections
        ;;
    category-collections)
        seed_category_collections
        ;;
    product-collections)
        seed_collections
        ;;
    all)
        seed_brands
        seed_categories
        seed_products
        seed_inventory
        seed_collections
        seed_category_collections
        ;;
    *)
        echo "Usage: $0 [all|brands|categories|products|collections|category-collections|product-collections]"
        exit 1
        ;;
esac

echo ""
log_success "Seeding completed!"
echo ""
