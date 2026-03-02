// ============================================
// Orders Page - Order History & Details
// ============================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  ChevronRight,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  Filter,
  Calendar,
  Eye,
  RotateCcw,
  MessageSquare,
} from 'lucide-react';
import { cn, formatPrice } from '../utils';

// Mock orders data
const mockOrders = [
  {
    id: 'ORD-2024-001',
    date: '2024-01-15',
    status: 'delivered',
    total: 149.99,
    items: [
      {
        id: '1',
        name: 'HandiBeam Pro LED Work Glasses',
        image: 'https://images.unsplash.com/photo-1577174881658-0f30ed549adc?w=200',
        quantity: 1,
        price: 89.99,
      },
      {
        id: '2',
        name: 'USB-C Charging Cable',
        image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=200',
        quantity: 2,
        price: 29.99,
      },
    ],
  },
  {
    id: 'ORD-2024-002',
    date: '2024-01-20',
    status: 'shipped',
    total: 299.99,
    trackingNumber: 'LT123456789',
    items: [
      {
        id: '3',
        name: 'Professional Tool Set',
        image: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=200',
        quantity: 1,
        price: 299.99,
      },
    ],
  },
  {
    id: 'ORD-2024-003',
    date: '2024-01-25',
    status: 'processing',
    total: 79.99,
    items: [
      {
        id: '4',
        name: 'Wireless Earbuds',
        image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=200',
        quantity: 1,
        price: 79.99,
      },
    ],
  },
  {
    id: 'ORD-2024-004',
    date: '2024-01-10',
    status: 'cancelled',
    total: 199.99,
    items: [
      {
        id: '5',
        name: 'Smart Watch',
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200',
        quantity: 1,
        price: 199.99,
      },
    ],
  },
];

const statusConfig = {
  processing: {
    label: 'Processing',
    color: 'bg-blue-100 text-blue-600',
    icon: Clock,
  },
  shipped: {
    label: 'Shipped',
    color: 'bg-orange-100 text-orange-600',
    icon: Truck,
  },
  delivered: {
    label: 'Delivered',
    color: 'bg-green-100 text-green-600',
    icon: CheckCircle,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-600',
    icon: XCircle,
  },
};

type StatusFilter = 'all' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export default function OrdersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const filteredOrders = mockOrders.filter((order) => {
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
            <p className="text-gray-500">Track and manage your orders</p>
          </div>
          <Link
            to="/products"
            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            Continue Shopping
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by order ID or product name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
              >
                <option value="all">All Orders</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-500 mb-6">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : "You haven't placed any orders yet"}
            </p>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              Start Shopping
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const status = statusConfig[order.status as keyof typeof statusConfig];
              const StatusIcon = status.icon;
              const isExpanded = expandedOrder === order.id;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-xl shadow-sm overflow-hidden"
                >
                  {/* Order Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
                          <img
                            src={order.items[0].image}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {order.id}
                            </span>
                            <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', status.color)}>
                              <span className="flex items-center gap-1">
                                <StatusIcon className="w-3 h-3" />
                                {status.label}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(order.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                            <span>•</span>
                            <span>{order.items.length} item{order.items.length > 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-gray-900">
                          {formatPrice(order.total)}
                        </span>
                        <ChevronRight
                          className={cn(
                            'w-5 h-5 text-gray-400 transition-transform',
                            isExpanded && 'rotate-90'
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Order Details */}
                  {isExpanded && (
                    <div className="border-t">
                      {/* Order Items */}
                      <div className="p-4 space-y-4">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-4">
                            <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{item.name}</h4>
                              <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                            </div>
                            <span className="font-semibold text-gray-900">
                              {formatPrice(item.price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Tracking Info */}
                      {order.trackingNumber && (
                        <div className="mx-4 mb-4 p-4 bg-orange-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Truck className="w-5 h-5 text-orange-500" />
                              <div>
                                <p className="font-medium text-gray-900">Shipment Tracking</p>
                                <p className="text-sm text-gray-500">{order.trackingNumber}</p>
                              </div>
                            </div>
                            <button className="px-3 py-1.5 text-sm font-medium text-orange-500 hover:bg-orange-100 rounded-lg transition-colors">
                              Track Package
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Order Actions */}
                      <div className="p-4 bg-gray-50 flex flex-wrap gap-3">
                        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                          <Eye className="w-4 h-4" />
                          View Details
                        </button>
                        {order.status === 'delivered' && (
                          <>
                            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                              <RotateCcw className="w-4 h-4" />
                              Return Items
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                              <MessageSquare className="w-4 h-4" />
                              Write Review
                            </button>
                          </>
                        )}
                        {order.status === 'processing' && (
                          <button className="flex items-center gap-2 px-4 py-2 text-red-500 bg-white border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors">
                            <XCircle className="w-4 h-4" />
                            Cancel Order
                          </button>
                        )}
                        <button className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors ml-auto">
                          Buy Again
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {filteredOrders.length > 0 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
              Previous
            </button>
            <button className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium">
              1
            </button>
            <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
              2
            </button>
            <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
