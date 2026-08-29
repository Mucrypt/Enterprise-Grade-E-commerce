-- Real subcategory taxonomy under the store's 12 existing top-level
-- categories, plus precise reassignment of every existing product to its
-- correct new subcategory.
--
-- Why: the 12 top-level categories were mostly automotive-accessory
-- flavored (real inventory, kept as-is -- renaming/removing a live
-- category is disruptive to URLs/SEO and wasn't asked for). But the
-- founder's stated growth direction is professional trade tools
-- (woodworking, construction, "tech tools") -- confirmed by the
-- storefront's own ToolsHero copy ("Professional tools, machinery and
-- workshop equipment for woodworking, construction, metalworking and
-- skilled trades") and by real SKUs already live (pocket-hole jig, wood
-- door lock jig, digital caliper, woodworking measurement set) that were
-- sitting in categories that don't semantically fit them at all --
-- 'Tools & Emergency' is roadside/diagnostic gear, 'Work & Safety Gear'
-- is wearable PPE, neither is "woodworking."
--
-- 'Home Improvement & Tools' is the one genuinely general-purpose tools
-- category (its own description already says "power tools, hand tools,
-- measuring equipment... for everyday repairs, renovations and
-- professional projects") so it gets the richest subcategory set -- the
-- real home for the woodworking/construction growth this migration
-- exists to support. The other 11 keep their existing automotive focus
-- (real, populated inventory) but get real, specific subcategories
-- instead of staying flat.
--
-- No fabricated categories: every one below maps to either a real
-- product already in the catalog, or a standard, real subcategory a
-- hardware/auto-parts retailer in that exact space would carry -- never
-- an invented novelty. Idempotent (ON CONFLICT DO NOTHING on the unique
-- slug) so re-running this migration is safe.

-- =====================================================
-- Home Improvement & Tools -- expanded for the trade-tools growth focus
-- =====================================================
INSERT INTO categories (name, slug, description, parent_id, is_active, display_order)
SELECT v.name, v.slug, v.description, c.id, true, v.display_order
FROM categories c, (VALUES
  ('Power Tools', 'power-tools', 'Drills, drivers, saws and other corded/cordless power tools.', 0),
  ('Hand Tools', 'hand-tools', 'Wrenches, screwdrivers, pliers and everyday hand tools.', 1),
  ('Woodworking Tools', 'woodworking-tools', 'Jigs, clamps and tools for cabinetry, joinery and woodworking projects.', 2),
  ('Measuring & Layout Tools', 'measuring-layout-tools', 'Calipers, tape measures, levels and layout tools for precision work.', 3),
  ('Cabinet & Furniture Hardware', 'cabinet-furniture-hardware', 'Hinges, drill guides and hardware for cabinets and furniture.', 4),
  ('Fasteners & Hardware', 'fasteners-hardware', 'Screws, bolts, anchors and general hardware.', 5),
  ('Adhesives & Sealants', 'adhesives-sealants', 'Glues, caulks and sealants for repairs and builds.', 6),
  ('Ladders & Access Equipment', 'ladders-access-equipment', 'Ladders, step stools and access equipment for the job site.', 7)
) AS v(name, slug, description, display_order)
WHERE c.slug = 'home-improvement-tools'
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- Tools & Emergency -- refocused purely on roadside/diagnostic/emergency
-- =====================================================
INSERT INTO categories (name, slug, description, parent_id, is_active, display_order)
SELECT v.name, v.slug, v.description, c.id, true, v.display_order
FROM categories c, (VALUES
  ('Roadside Emergency Kits', 'roadside-emergency-kits', 'Emergency kits and essentials for roadside breakdowns.', 0),
  ('Jump Starters & Battery Chargers', 'jump-starters-battery-chargers', 'Portable jump starters and battery charging equipment.', 1),
  ('Tire Repair & Inflation', 'tire-repair-inflation', 'Tire pressure gauges, inflators and repair kits.', 2),
  ('Diagnostic Scanners', 'diagnostic-scanners', 'OBD2 scanners and vehicle diagnostic tools.', 3),
  ('Flashlights & Emergency Lighting', 'flashlights-emergency-lighting', 'Flashlights, road flares and emergency lighting.', 4),
  ('Multimeters & Electrical Testers', 'multimeters-electrical-testers', 'Multimeters and electrical testing tools.', 5)
) AS v(name, slug, description, display_order)
WHERE c.slug = 'tools-emergency'
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- Car Electronics
-- =====================================================
INSERT INTO categories (name, slug, description, parent_id, is_active, display_order)
SELECT v.name, v.slug, v.description, c.id, true, v.display_order
FROM categories c, (VALUES
  ('Bluetooth & CarPlay Adapters', 'bluetooth-carplay-adapters', 'Wireless CarPlay/Android Auto adapters and Bluetooth kits.', 0),
  ('GPS Trackers & Navigation', 'gps-trackers-navigation', 'GPS trackers and navigation devices.', 1),
  ('Wireless Chargers', 'wireless-chargers-car', 'In-car wireless charging devices.', 2),
  ('Backup Cameras & Sensors', 'backup-cameras-sensors', 'Backup cameras and parking sensors.', 3),
  ('Car Alarms & Immobilizers', 'car-alarms-immobilizers', 'Car alarms and anti-theft immobilizers.', 4),
  ('Portable Power & Inflation', 'portable-power-inflation', 'Portable air compressors and power devices for the car.', 5)
) AS v(name, slug, description, display_order)
WHERE c.slug = 'car-electronics'
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- Interior & Comfort
-- =====================================================
INSERT INTO categories (name, slug, description, parent_id, is_active, display_order)
SELECT v.name, v.slug, v.description, c.id, true, v.display_order
FROM categories c, (VALUES
  ('Seat Covers', 'seat-covers', 'Seat covers for every seat type.', 0),
  ('Floor Mats & Liners', 'floor-mats-liners', 'Floor mats and all-weather liners.', 1),
  ('Organizers & Storage', 'organizers-storage', 'Trunk organizers and in-car storage solutions.', 2),
  ('Sun Shades & Window Accessories', 'sun-shades-window-accessories', 'Sun shades and window accessories.', 3),
  ('Seat Cushions & Support', 'seat-cushions-support', 'Seat cushions and ergonomic support accessories.', 4),
  ('Air Fresheners & Purifiers', 'air-fresheners-purifiers', 'Air fresheners and cabin air purifiers.', 5)
) AS v(name, slug, description, display_order)
WHERE c.slug = 'interior-comfort'
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- Safety & Security
-- =====================================================
INSERT INTO categories (name, slug, description, parent_id, is_active, display_order)
SELECT v.name, v.slug, v.description, c.id, true, v.display_order
FROM categories c, (VALUES
  ('Dash Cams & Recording', 'dash-cams-recording', 'Dash cams and driving recorders.', 0),
  ('Tire Pressure Monitoring', 'tire-pressure-monitoring', 'TPMS and tire pressure monitoring systems.', 1),
  ('Steering Wheel & Anti-Theft Locks', 'steering-wheel-anti-theft-locks', 'Steering wheel locks and anti-theft devices.', 2),
  ('First Aid & Fire Safety', 'first-aid-fire-safety', 'First aid kits and fire safety equipment.', 3),
  ('Reflective & Visibility Gear', 'reflective-visibility-gear', 'Reflective triangles and visibility gear.', 4),
  ('Head-Up Displays & Alerts', 'head-up-displays-alerts', 'Head-up displays and driver alert systems.', 5)
) AS v(name, slug, description, display_order)
WHERE c.slug = 'safety-security'
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- Audio & Entertainment
-- =====================================================
INSERT INTO categories (name, slug, description, parent_id, is_active, display_order)
SELECT v.name, v.slug, v.description, c.id, true, v.display_order
FROM categories c, (VALUES
  ('Car Speakers', 'car-speakers', 'Car speakers for every install.', 0),
  ('Subwoofers & Amplifiers', 'subwoofers-amplifiers', 'Subwoofers and amplifiers.', 1),
  ('Head Units & Touchscreens', 'head-units-touchscreens', 'Touchscreen head units and stereos.', 2),
  ('Bluetooth & Wireless Audio', 'bluetooth-wireless-audio', 'Bluetooth receivers and wireless audio devices.', 3),
  ('Wiring & Installation Kits', 'wiring-installation-kits', 'Wiring harnesses and installation kits.', 4)
) AS v(name, slug, description, display_order)
WHERE c.slug = 'audio-entertainment'
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- Exterior Accessories
-- =====================================================
INSERT INTO categories (name, slug, description, parent_id, is_active, display_order)
SELECT v.name, v.slug, v.description, c.id, true, v.display_order
FROM categories c, (VALUES
  ('Roof Racks & Cargo Carriers', 'roof-racks-cargo-carriers', 'Roof racks and cargo carriers.', 0),
  ('Car Covers', 'car-covers', 'Indoor and outdoor car covers.', 1),
  ('Mud Flaps & Splash Guards', 'mud-flaps-splash-guards', 'Mud flaps and splash guards.', 2),
  ('Body Kits & Spoilers', 'body-kits-spoilers', 'Body kits, spoilers and styling accessories.', 3),
  ('Mirrors & Window Visors', 'mirrors-window-visors', 'Mirrors and window visors.', 4),
  ('License Plate Accessories', 'license-plate-accessories', 'License plate frames and accessories.', 5)
) AS v(name, slug, description, display_order)
WHERE c.slug = 'exterior-accessories'
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- Lighting
-- =====================================================
INSERT INTO categories (name, slug, description, parent_id, is_active, display_order)
SELECT v.name, v.slug, v.description, c.id, true, v.display_order
FROM categories c, (VALUES
  ('LED Headlight Bulbs', 'led-headlight-bulbs', 'LED headlight bulb upgrades.', 0),
  ('LED Light Bars', 'led-light-bars', 'LED light bars for work and off-road use.', 1),
  ('Interior LED Kits', 'interior-led-kits', 'Interior LED strip and accent lighting kits.', 2),
  ('Fog & Driving Lights', 'fog-driving-lights', 'Fog lights and auxiliary driving lights.', 3),
  ('Underglow & Accent Lighting', 'underglow-accent-lighting', 'Underglow and accent lighting kits.', 4),
  ('Turn Signal & Brake Lights', 'turn-signal-brake-lights', 'Turn signal and brake light upgrades.', 5)
) AS v(name, slug, description, display_order)
WHERE c.slug = 'lighting'
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- Cleaning & Maintenance
-- =====================================================
INSERT INTO categories (name, slug, description, parent_id, is_active, display_order)
SELECT v.name, v.slug, v.description, c.id, true, v.display_order
FROM categories c, (VALUES
  ('Car Wash Kits & Soap', 'car-wash-kits-soap', 'Car wash kits and soap.', 0),
  ('Wax, Polish & Ceramic Coating', 'wax-polish-ceramic-coating', 'Wax, polish and ceramic coating products.', 1),
  ('Vacuum Cleaners', 'vacuum-cleaners', 'Portable and cordless vacuum cleaners.', 2),
  ('Microfiber Towels & Applicators', 'microfiber-towels-applicators', 'Microfiber towels and detailing applicators.', 3),
  ('Interior & Upholstery Cleaners', 'interior-upholstery-cleaners', 'Interior and upholstery cleaning products.', 4),
  ('Tire & Wheel Cleaners', 'tire-wheel-cleaners', 'Tire shine and wheel cleaning products.', 5)
) AS v(name, slug, description, display_order)
WHERE c.slug = 'cleaning-maintenance'
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- Phone & GPS Mounts
-- =====================================================
INSERT INTO categories (name, slug, description, parent_id, is_active, display_order)
SELECT v.name, v.slug, v.description, c.id, true, v.display_order
FROM categories c, (VALUES
  ('Dashboard Mounts', 'dashboard-mounts', 'Dashboard phone mounts.', 0),
  ('Vent Mounts', 'vent-mounts', 'Air vent phone mounts.', 1),
  ('Wireless Charging Mounts', 'wireless-charging-mounts', 'Phone mounts with built-in wireless charging.', 2),
  ('Windshield Mounts', 'windshield-mounts', 'Windshield-mounted phone holders.', 3),
  ('Cup Holder Mounts', 'cup-holder-mounts', 'Cup holder phone and tablet mounts.', 4)
) AS v(name, slug, description, display_order)
WHERE c.slug = 'phone-gps-mounts'
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- Performance Parts
-- =====================================================
INSERT INTO categories (name, slug, description, parent_id, is_active, display_order)
SELECT v.name, v.slug, v.description, c.id, true, v.display_order
FROM categories c, (VALUES
  ('Cold Air Intakes', 'cold-air-intakes', 'Cold air intake systems.', 0),
  ('Exhaust Systems', 'exhaust-systems', 'Performance exhaust systems.', 1),
  ('Performance Chips & Tuners', 'performance-chips-tuners', 'Performance chips and ECU tuners.', 2),
  ('Suspension & Handling', 'suspension-handling', 'Suspension and handling upgrades.', 3),
  ('Turbochargers & Superchargers', 'turbochargers-superchargers', 'Forced induction upgrades.', 4),
  ('Brake Upgrades', 'brake-upgrades', 'Performance brake upgrades.', 5)
) AS v(name, slug, description, display_order)
WHERE c.slug = 'performance-parts'
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- Work & Safety Gear -- refocused on wearable PPE
-- =====================================================
INSERT INTO categories (name, slug, description, parent_id, is_active, display_order)
SELECT v.name, v.slug, v.description, c.id, true, v.display_order
FROM categories c, (VALUES
  ('Work Gloves', 'work-gloves', 'Work gloves for the job site and shop.', 0),
  ('Safety Glasses & Eyewear', 'safety-glasses-eyewear', 'Safety glasses and protective eyewear.', 1),
  ('Headlamps & Handheld Lighting', 'headlamps-handheld-lighting', 'Headlamps and handheld work lighting.', 2),
  ('Ear & Respiratory Protection', 'ear-respiratory-protection', 'Hearing and respiratory protection.', 3),
  ('Hi-Vis Apparel', 'hi-vis-apparel', 'High-visibility safety apparel.', 4),
  ('Knee Pads & Protective Wear', 'knee-pads-protective-wear', 'Knee pads and other protective wear.', 5)
) AS v(name, slug, description, display_order)
WHERE c.slug = 'work-safety-gear'
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- Reassign every existing product to its correct, specific subcategory
-- (matched by product slug -- precise, not a guess). This is the actual
-- "products in the right place" fix: three of these also move a product
-- out of a category it never semantically belonged in (two woodworking
-- jigs out of 'Tools & Emergency', a woodworking measuring set out of
-- 'Work & Safety Gear') and into the real Home Improvement & Tools
-- subcategories that fit them.
-- =====================================================
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'measuring-layout-tools' AND p.slug = 'kc44-digital-caliper-with-lcd-display-0-100mm-4-29d6d68f';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'cabinet-furniture-hardware' AND p.slug = 'faryodi-adjustable-cabinet-hardware-drill-guide-blue-766f22d5';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'woodworking-tools' AND p.slug = 'portable-wood-door-lock-installation-drill-jig-mortice-kit-6a75ccbb';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'woodworking-tools' AND p.slug = 'vevor-aluminum-alloy';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'measuring-layout-tools' AND p.slug = 'woodworking-measurement-set-with-a-storage-box-designed-for-planning-and-layout-of-woodworking-projects-including-a-multi-angle-combination-triangle-ruler-angle-sharpening-dovetail-gauge';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'vacuum-cleaners' AND p.slug = 'cordless-car-vacuum-cleaner-12000pa';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'diagnostic-scanners' AND p.slug = 'obd2-bluetooth-scanner-diagnostic-tool';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'tire-repair-inflation' AND p.slug = 'digital-tire-pressure-gauge-backlit';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'organizers-storage' AND p.slug = 'collapsible-car-trunk-organizer-cooler';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'seat-covers' AND p.slug = 'premium-leather-seat-covers-full-set';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'headlamps-handheld-lighting' AND p.slug = 'led-light-bar-mechanic-creeper-36inch';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'flashlights-emergency-lighting' AND p.slug = 'led-road-flares-emergency-disc-3pack';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'interior-led-kits' AND p.slug = 'car-interior-led-strip-kit-rgb';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'flashlights-emergency-lighting' AND p.slug = 'tactical-led-flashlight-5000-lumens';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'headlamps-handheld-lighting' AND p.slug = 'ultra-bright-led-headlamp-2000-lumens';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'safety-glasses-eyewear' AND p.slug = 'handibeam-led-safety-glasses';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'jump-starters-battery-chargers' AND p.slug = 'portable-jump-starter-power-bank-2000a';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'cold-air-intakes' AND p.slug = 'cold-air-intake-kit-high-flow-filter';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'portable-power-inflation' AND p.slug = 'digital-tire-inflator-portable-compressor';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'wireless-charging-mounts' AND p.slug = 'wireless-car-charger-mount-auto-clamping';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'dash-cams-recording' AND p.slug = '4k-dual-dash-cam-night-vision-gps';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'head-units-touchscreens' AND p.slug = 'premium-7inch-touchscreen-car-stereo';
UPDATE products p SET category_id = c.id FROM categories c WHERE c.slug = 'bluetooth-carplay-adapters' AND p.slug = '2-in-1-wireless-carplay-android-auto-adapter-ultra-fast-low-latency';
