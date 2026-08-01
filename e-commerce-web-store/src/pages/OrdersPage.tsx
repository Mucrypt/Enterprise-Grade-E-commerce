// ============================================
// Orders Page - Order History & Details
// ============================================

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  ChevronRight,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  RotateCcw,
  Search,
  Filter,
  Calendar,
  Loader,
} from 'lucide-react';
import { cn, formatPrice } from '../utils';
import { ordersApiNew } from '../api';
import { useAuthStore } from '../stores';

const statusConfig: Record<
  string,
  { label: string; color: string; icon: typeof Clock }
> = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-600', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-600', icon: CheckCircle },
  processing: { label: 'Processing', color: 'bg-blue-100 text-blue-600', icon: Clock },
  ready_to_ship: { label: 'Ready to Ship', color: 'bg-orange-100 text-orange-600', icon: Package },
  shipped: { label: 'Shipped', color: 'bg-orange-100 text-orange-600', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-600', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-600', icon: XCircle },
  refunded: { label: 'Refunded', color: 'bg-red-100 text-red-600', icon: RotateCcw },
};

const CANCELLABLE_STATUSES = new Set(['pending', 'confirmed', 'processing']);

type StatusFilter = 'all' | keyof typeof statusConfig;

interface OrderSummary {
  id: string;
  order_number: string;
  order_status: string;
  payment_status: string;
  grand_total: number;
  created_at: string;
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/orders' } } });
    }
  }, [hasHydrated, isAuthenticated, navigate]);

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['my-orders', page],
    queryFn: () => ordersApiNew.getAll(page, 20),
    enabled: hasHydrated && isAuthenticated,
  });

  const orders = (ordersData?.orders ?? []) as OrderSummary[];
  const pagination = ordersData?.pagination;

  const { data: expandedDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['order-detail', expandedOrder],
    queryFn: () => ordersApiNew.getById(expandedOrder as string),
    enabled: !!expandedOrder,
  });

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.order_number
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || order.order_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCancel = async (orderId: string) => {
    if (!window.confirm('Cancel this order? This cannot be undone.')) return;
    setCancellingId(orderId);
    try {
      await ordersApiNew.cancel(orderId);
      await queryClient.invalidateQueries({ queryKey: ['my-orders'] });
    } catch (err) {
      console.error('Failed to cancel order:', err);
      window.alert('Failed to cancel this order. Please contact support.');
    } finally {
      setCancellingId(null);
    }
  };

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
                placeholder="Search by order number..."
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
                {Object.entries(statusConfig).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Loader className="w-8 h-8 text-orange-500 mx-auto animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
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
              const status =
                statusConfig[order.order_status] ?? statusConfig.pending;
              const StatusIcon = status.icon;
              const isExpanded = expandedOrder === order.id;
              const isCancellable = CANCELLABLE_STATUSES.has(order.order_status);

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
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {order.order_number}
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
                            {new Date(order.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-gray-900">
                          {formatPrice(order.grand_total)}
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
                      {detailLoading ? (
                        <div className="p-6 text-center">
                          <Loader className="w-6 h-6 text-orange-500 mx-auto animate-spin" />
                        </div>
                      ) : (
                        <div className="p-4 space-y-3">
                          {expandedDetail?.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-4">
                              <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                                <Package className="w-6 h-6 text-gray-400" />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900">
                                  {item.product_name}
                                </h4>
                                <p className="text-sm text-gray-500">
                                  Qty: {item.quantity}
                                </p>
                              </div>
                              <span className="font-semibold text-gray-900">
                                {formatPrice(item.total_price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Order Actions */}
                      <div className="p-4 bg-gray-50 flex flex-wrap gap-3">
                        <Link
                          to={`/track-order?orderNumber=${encodeURIComponent(order.order_number)}`}
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                          <Truck className="w-4 h-4" />
                          Track Package
                        </Link>
                        {isCancellable && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancel(order.id);
                            }}
                            disabled={cancellingId === order.id}
                            className="flex items-center gap-2 px-4 py-2 text-red-500 bg-white border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            {cancellingId === order.id ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            Cancel Order
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-gray-600">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
