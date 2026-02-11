// Re-export all generated types from database
export * from './generated'

// Type aliases for backward compatibility and convenience
// The generated types use table names (Users, Products, etc.)
import type {
  Users,
  Products,
  Categories,
  ProductMedia,
  CategoryMedia,
  ProductCollections,
  ProductCollectionItems,
  CategoryCollections,
  CategoryCollectionItems,
} from './generated'

// Singular aliases for better ergonomics
export type User = Users
export type Product = Products
export type Category = Categories
export type MediaFile = ProductMedia | CategoryMedia
export type Collection = ProductCollections | CategoryCollections
