// ============================================
// TechTools Mobile App - Type Definitions
// ============================================

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  base_price: number | string;
  sale_price: number | string | null;
  cost_price: number | string;
  category_id: string;
  brand_id: string | null;
  category_name: string;
  category_slug: string;
  brand_name: string | null;
  brand_slug: string | null;
  weight: number | string;
  weight_unit: string;
  is_active: boolean;
  is_featured: boolean;
  total_stock: number;
  images: ProductImage[] | null;
  media?: ProductImage[] | null;
  specifications?: ProductSpecification[] | null;
  inventory?: ProductInventory[];
  average_rating?: number | string;
  review_count?: number | string;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt_text: string;
  is_primary: boolean;
  position: number;
}

export interface ProductSpecification {
  id: string;
  spec_key: string;
  spec_value: string;
  spec_group: string;
  display_order: number;
}

export interface ProductInventory {
  id: string;
  warehouse_location: string;
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  low_stock_threshold: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  is_active: boolean;
  display_order: number;
  product_count?: number;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  is_active: boolean;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  first_name: string;
  last_name: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string;
  is_default: boolean;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  subtotal: number | string;
  tax_amount: number | string;
  shipping_amount: number | string;
  discount_amount: number | string;
  total_amount: number | string;
  shipping_address: Address;
  billing_address: Address;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string;
  quantity: number;
  unit_price: number | string;
  total_price: number | string;
}

export type OrderStatus = 
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  variant?: ProductVariant;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  price_adjustment: number;
  attributes: Record<string, string>;
  stock: number;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  title: string;
  comment: string;
  is_verified_purchase: boolean;
  helpful_count: number;
  created_at: string;
}

export interface ProductFilters {
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  featured?: boolean;
  sortBy?: string;
  search?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface FlashDeal {
  id: string;
  product: Product;
  discount_percentage: number;
  ends_at: string;
  badge: 'HOT' | 'FLASH' | 'DEAL';
}

export interface PromoBanner {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  gradient: string[];
}
