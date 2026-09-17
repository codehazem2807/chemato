// ============================================================
// CHEMOTO 3.0 — Enterprise Intelligence Engine
// Inspired by: ChemCloud, 石化e贸, Clariant, Knowde
// ============================================================

// ============================================================
// 1. REAL-TIME COMMODITY PRICES (Live Ticker)
// ============================================================
const CommodityTracker = {
    // استخدام OilPriceAPI للمواد البتروكيماوية [citation:39]
    // أو أي API عام للمعادن
    commodities: [
        { code: 'BRENT_CRUDE_USD', name: 'خام برنت', unit: '$/برميل' },
        { code: 'NATURAL_GAS_USD', name: 'الغاز الطبيعي', unit: '$/MMBtu' },
        { code: 'GOLD_USD', name: 'الذهب', unit: '$/أونصة' },
        { code: 'ETHYLENE_USD', name: 'الإيثيلين', unit: '$/طن' },
        { code: 'METHANOL_USD', name: 'الميثانول', unit: '$/طن' },
        { code: 'SODA_ASH_USD', name: 'رماد الصودا', unit: '$/طن' },
    ],

    prices: {},
    previousPrices: {},

    async fetchPrices() {
        // Demo data - في الإنتاج استخدم API حقيقي
        // OilPriceAPI offers free tier with 50 req/month [citation:39]
        
        const demoPrices = {
            'BRENT_CRUDE_USD': { price: 78.45, change: +1.2 },
            'NATURAL_GAS_USD': { price: 2.85, change: -0.8 },
            'GOLD_USD': { price: 2345.60, change: +0.3 },
            'ETHYLENE_USD': { price: 985.00, change: +2.1 },
            'METHANOL_USD': { price: 342.50, change: -1.5 },
            'SODA_ASH_USD': { price: 285.00, change: +0.7 },
        };

        // Try real API if configured
        try {
            if (window.ENV?.OIL_PRICE_API_KEY) {
                const codes = this.commodities.map(c => c.code).join(',');
                const response = await fetch(
                    `https://api.oilpriceapi.com/v1/prices/latest?by_code=${codes}`,
                    { headers: { 'Authorization': `Token ${window.ENV.OIL_PRICE_API_KEY}` } }
                );
                if (response.ok) {
                    const data = await response.json();
                    data.data?.forEach(item => {
                        this.prices[item.code] = {
                            price: item.price,
                            change: item.change || 0
                        };
                    });
                }
            } else {
                this.prices = demoPrices;
            }
        } catch (e) {
            this.prices = demoPrices;
        }

        this.renderTicker();
    },

    renderTicker() {
        const ticker = document.getElementById('commodityTicker');
        if (!ticker) return;

        const items = this.commodities.map(commodity => {
            const data = this.prices[commodity.code] || { price: 0, change: 0 };
            const changeClass = data.change >= 0 ? 'up' : 'down';
            const changeSymbol = data.change >= 0 ? '▲' : '▼';
            
            return `
                <div class="ticker-item">
                    <span class="symbol">${commodity.name}</span>
                    <span class="price">${data.price.toFixed(2)}</span>
                    <span class="change ${changeClass}">${changeSymbol} ${Math.abs(data.change).toFixed(2)}%</span>
                </div>
            `;
        }).join('');

        // Duplicate for seamless loop
        ticker.innerHTML = `
            <div class="ticker-content">
                ${items}${items}
            </div>
        `;
        ticker.classList.add('show');
    },

    init() {
        this.fetchPrices();
        // Update every 5 minutes
        setInterval(() => this.fetchPrices(), 5 * 60 * 1000);
    }
};

// ============================================================
// 2. MOLECULAR VISUALIZER (Hero Background)
// ============================================================
const MolecularVisualizer = {
    nodes: [],
    
    init() {
        const container = document.getElementById('moleculeVisualizer');
        if (!container) return;

        // Create animated molecule nodes
        const positions = [
            { top: '15%', left: '10%' },
            { top: '25%', left: '25%' },
            { top: '45%', left: '15%' },
            { top: '70%', left: '20%' },
            { top: '20%', right: '15%' },
            { top: '40%', right: '25%' },
            { top: '60%', right: '10%' },
            { top: '80%', right: '30%' },
            { top: '35%', left: '45%' },
            { top: '55%', left: '50%' },
        ];

        positions.forEach((pos, i) => {
            const node = document.createElement('div');
            node.className = 'molecule-node';
            Object.assign(node.style, pos);
            node.style.animationDelay = `${i * 0.3}s`;
            container.appendChild(node);
        });
    }
};

// ============================================================
// 3. AI-POWERED SEMANTIC SEARCH
// Using Supabase Vector + pgvector [citation:36]
// ============================================================
const SemanticSearch = {
    // Generate embedding using gte-small model
    // Can run natively in Edge Functions [citation:35]
    
    async generateEmbedding(text) {
        // Demo: return random vector
        // In production: use Supabase Edge Function with gte-small
        return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
    },

    async search(query, options = {}) {
        if (!query?.trim()) return [];

        try {
            // Option A: If Edge Function deployed
            if (window.ENV?.SEMANTIC_SEARCH_ENABLED) {
                const { data, error } = await supabase.functions.invoke('search', {
                    body: { query, ...options }
                });
                if (!error && data) return data;
            }

            // Option B: Fallback to RPC
            const embedding = await this.generateEmbedding(query);
            const { data, error } = await supabase.rpc('match_products', {
                query_embedding: embedding,
                match_threshold: 0.7,
                match_count: 20,
                ...options
            });

            if (error) throw error;
            return data || [];

        } catch (e) {
            console.warn('Semantic search failed, falling back to ILIKE:', e);
            // Fallback to traditional search
            const { data } = await supabase
                .from('products')
                .select('*')
                .ilike('name', `%${query}%`)
                .limit(20);
            return data || [];
        }
    },

    // Parse natural language queries
    parseNaturalLanguage(query) {
        const patterns = [
            {
                regex: /(\d+)\s*(طن|كجم|لتر)/i,
                extract: (m) => ({ quantity: parseInt(m[1]), unit: m[2] })
            },
            {
                regex: /(?:سعر|بـ|بسعر)\s*(\d+)\s*(?:ج\.م|جنيه|EGP)/i,
                extract: (m) => ({ maxPrice: parseInt(m[1]) })
            },
            {
                regex: /(?:نقاء|درجة نقاء)\s*(\d+)%/i,
                extract: (m) => ({ purity: parseInt(m[1]) })
            },
            {
                regex: /(?:درجة|grade)\s*(تقني|تحليلي|صيدلاني|غذائي|ACS)/i,
                extract: (m) => ({ grade: m[1] })
            },
            {
                regex: /(?:في|بمدينة|منطقة)\s*(القاهرة|الإسكندرية|الجيزة|بورسعيد|السويس|طنطا|المنصورة|أسيوط)/i,
                extract: (m) => ({ location: m[1] })
            },
            {
                regex: /(?:خلال|في مدة|يصل في)\s*(\d+)\s*(يوم|أسبوع)/i,
                extract: (m) => ({ maxDeliveryDays: m[2] === 'أسبوع' ? parseInt(m[1]) * 7 : parseInt(m[1]) })
            }
        ];

        const filters = {};
        let cleanQuery = query;

        patterns.forEach(pattern => {
            const match = query.match(pattern.regex);
            if (match) {
                Object.assign(filters, pattern.extract(match));
                cleanQuery = cleanQuery.replace(match[0], '').trim();
            }
        });

        return { query: cleanQuery, filters };
    }
};

// ============================================================
// 4. SMART RFQ SYSTEM (Multi-Quote Engine)
// ============================================================
const SmartRFQ = {
    async createRFQ(data) {
        if (!state.user) {
            showToast('🔒', 'مطلوب تسجيل دخول', 'سجّل دخولك لإنشاء طلب عرض سعر',
                'تسجيل الدخول', 'auth.html?redirect=rfq', 'warning');
            return null;
        }

        try {
            // 1. Create RFQ
            const { data: rfq, error: rfqError } = await supabase
                .from('purchase_requests')
                .insert({
                    buyer_id: state.user.id,
                    product_name: data.product_name,
                    cas_number: data.cas_number,
                    purity_required: data.purity,
                    category: data.category,
                    quantity_needed: `${data.quantity} ${data.unit}`,
                    preferred_unit: data.unit,
                    description: data.notes,
                    location: data.location,
                    deadline: data.deadline,
                    budget_min: data.budget_min,
                    budget_max: data.budget_max,
                    status: 'open',
                })
                .select()
                .single();

            if (rfqError) throw rfqError;

            // 2. Find matching suppliers and notify them
            const matchedSuppliers = await this.findMatchingSuppliers(data);
            
            // 3. Send notifications (via Broadcast)
            this.notifySuppliers(rfq.id, matchedSuppliers);

            // 4. Return RFQ with potential suppliers count
            return {
                ...rfq,
                matched_suppliers: matchedSuppliers.length
            };

        } catch (e) {
            console.error('RFQ creation failed:', e);
            throw e;
        }
    },

    async findMatchingSuppliers(rfq) {
        // Find suppliers who have the product or similar
        const { data: products } = await supabase
            .from('products')
            .select('supplier_id, name, cas_number')
            .eq('status', 'active')
            .or(`name.ilike.%${rfq.product_name}%,cas_number.eq.${rfq.cas_number}`);

        const supplierIds = [...new Set((products || []).map(p => p.supplier_id).filter(Boolean))];

        // Filter by verified suppliers
        const { data: suppliers } = await supabase
            .from('profiles')
            .select('id, company_name, is_verified')
            .in('id', supplierIds)
            .eq('user_type', 'supplier');

        return suppliers || [];
    },

    async notifySuppliers(rfqId, suppliers) {
        // Send via Supabase Broadcast [citation:23]
        if (!state.channel) return;

        for (const supplier of suppliers) {
            try {
                await state.channel.send({
                    type: 'broadcast',
                    event: 'new_rfq',
                    payload: {
                        rfq_id: rfqId,
                        supplier_id: supplier.id,
                        message: `طلب عرض سعر جديد متطابق مع منتجاتك`
                    }
                });
            } catch (e) {
                console.warn('Broadcast failed:', e);
            }
        }
    },

    async getQuotes(rfqId) {
        const { data, error } = await supabase
            .from('quotes')
            .select(`
                *,
                supplier:profiles!supplier_id (
                    id, company_name, is_verified, rating
                )
            `)
            .eq('rfq_id', rfqId)
            .order('unit_price', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async submitQuote(quoteData) {
        const { data, error } = await supabase
            .from('quotes')
            .insert({
                rfq_id: quoteData.rfq_id,
                supplier_id: state.user.id,
                product_id: quoteData.product_id,
                unit_price: quoteData.unit_price,
                currency: quoteData.currency || 'EGP',
                quantity_available: quoteData.quantity_available,
                unit: quoteData.unit || 'كجم',
                payment_terms: quoteData.payment_terms,
                delivery_days: quoteData.delivery_days,
                delivery_terms: quoteData.delivery_terms,
                coa_available: quoteData.coa_available,
                msds_available: quoteData.msds_available,
                valid_until: quoteData.valid_until,
                notes: quoteData.notes,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};

// ============================================================
// 5. SUPPLIER VERIFICATION SYSTEM
// ============================================================
const SupplierVerification = {
    async calculateScore(supplierId) {
        const checks = [];

        // 1. Company registration
        const { data: profile } = await supabase
            .from('profiles')
            .select('company_name, is_verified, created_at')
            .eq('id', supplierId)
            .single();

        checks.push({
            name: 'سجل تجاري',
            verified: !!profile?.company_name,
            weight: 20
        });

        // 2. Verification status
        checks.push({
            name: 'توثيق المنصة',
            verified: profile?.is_verified,
            weight: 25
        });

        // 3. Account age
        const accountAgeDays = profile?.created_at 
            ? (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
            : 0;
        checks.push({
            name: 'عمر الحساب (أكثر من 90 يوم)',
            verified: accountAgeDays > 90,
            weight: 15
        });

        // 4. Products count
        const { count: productsCount } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('supplier_id', supplierId)
            .eq('status', 'active');

        checks.push({
            name: 'منتجات منشورة (10+)',
            verified: (productsCount || 0) >= 10,
            weight: 15
        });

        // 5. Response rate (from quotes)
        const { count: quotesCount } = await supabase
            .from('quotes')
            .select('*', { count: 'exact', head: true })
            .eq('supplier_id', supplierId);

        checks.push({
            name: 'تفاعل مع الطلبات',
            verified: (quotesCount || 0) > 0,
            weight: 15
        });

        // 6. Ratings
        const { data: ratings } = await supabase
            .from('supplier_ratings')
            .select('rating_overall')
            .eq('supplier_id', supplierId);

        const avgRating = ratings?.length
            ? ratings.reduce((sum, r) => sum + r.rating_overall, 0) / ratings.length
            : 0;

        checks.push({
            name: 'تقييمات العملاء (4+)',
            verified: avgRating >= 4,
            weight: 10
        });

        // Calculate score
        const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
        const earnedWeight = checks
            .filter(c => c.verified)
            .reduce((sum, c) => sum + c.weight, 0);

        const score = Math.round((earnedWeight / totalWeight) * 100);

        return {
            score,
            checks,
            level: score >= 80 ? 'gold' : score >= 60 ? 'silver' : score >= 40 ? 'bronze' : 'unverified'
        };
    },

    renderPanel(verification) {
        const levelColors = {
            gold: '#FFD700',
            silver: '#C0C0C0',
            bronze: '#CD7F32',
            unverified: '#9CA3AF'
        };

        return `
            <div class="verification-panel">
                <div class="verification-header">
                    <div class="verification-score" style="background: ${levelColors[verification.level]}">
                        ${verification.score}
                    </div>
                    <div>
                        <div style="font-weight: 800; font-size: 1.1rem;">
                            مستوى التحقق: ${verification.level === 'gold' ? 'ذهبي' : 
                                           verification.level === 'silver' ? 'فضي' :
                                           verification.level === 'bronze' ? 'برونزي' : 'غير موثق'}
                        </div>
                        <div style="font-size: 0.8rem; color: var(--c-text-sub);">
                            ${verification.checks.filter(c => c.verified).length} من ${verification.checks.length} معايير مكتملة
                        </div>
                    </div>
                </div>
                <div class="verification-checks">
                    ${verification.checks.map(check => `
                        <div class="verification-item">
                            <span class="check ${check.verified ? 'verified' : 'pending'}">
                                ${check.verified ? '✓' : '○'}
                            </span>
                            <span>${check.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
};

// ============================================================
// 6. SMART NOTIFICATION CENTER
// ============================================================
const SmartNotifications = {
    notifications: [],
    unreadCount: 0,

    async load() {
        if (!state.user) return;

        try {
            // Load from database
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', state.user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            this.notifications = data || [];
            this.updateBadge();
            this.render();
        } catch (e) {
            // Fallback to localStorage
            this.notifications = JSON.parse(localStorage.getItem('chemato-notifications') || '[]');
            this.updateBadge();
        }
    },

    async add(notification) {
        const newNotification = {
            id: Date.now(),
            ...notification,
            read: false,
            created_at: new Date().toISOString()
        };

        this.notifications.unshift(newNotification);
        this.notifications = this.notifications.slice(0, 50);
        
        // Save
        if (state.user) {
            await supabase.from('notifications').insert({
                user_id: state.user.id,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                data: notification.data,
            }).catch(() => {});
        } else {
            localStorage.setItem('chemato-notifications', JSON.stringify(this.notifications));
        }

        this.updateBadge();
        this.render();
        this.showToastNotification(newNotification);
    },

    updateBadge() {
        this.unreadCount = this.notifications.filter(n => !n.read).length;
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            badge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
        }
    },

    render() {
        const panel = document.getElementById('notificationPanel');
        const list = document.getElementById('notificationList');
        if (!panel || !list) return;

        if (!this.notifications.length) {
            list.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px; border: none;">
                    <i class="fas fa-bell-slash" style="font-size: 2rem; opacity: 0.3;"></i>
                    <p style="margin-top: 12px; color: var(--c-text-sub);">لا توجد إشعارات</p>
                </div>
            `;
            return;
        }

        const iconMap = {
            price_drop: { icon: 'chart-line', class: 'price-drop' },
            new_quote: { icon: 'file-invoice', class: 'new-quote' },
            stock_alert: { icon: 'exclamation-triangle', class: 'stock-alert' },
            new_product: { icon: 'box', class: 'new-product' },
            rfq_response: { icon: 'reply', class: 'new-quote' },
        };

        list.innerHTML = this.notifications.map(n => {
            const icon = iconMap[n.type] || { icon: 'bell', class: '' };
            const timeAgo = this.timeAgo(n.created_at);
            
            return `
                <div class="notification-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
                    <div class="notification-icon ${icon.class}">
                        <i class="fas fa-${icon.icon}"></i>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 2px;">
                            ${escapeHtml(n.title)}
                        </div>
                        <div style="font-size: 0.78rem; color: var(--c-text-muted); line-height: 1.4;">
                            ${escapeHtml(n.message)}
                        </div>
                        <div style="font-size: 0.7rem; color: var(--c-text-sub); margin-top: 4px;">
                            ${timeAgo}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    timeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'الآن';
        if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
        if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;
        if (seconds < 604800) return `منذ ${Math.floor(seconds / 86400)} يوم`;
        return date.toLocaleDateString('ar-EG');
    },

    async markAsRead(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            notification.read = true;
            this.updateBadge();
            this.render();

            if (state.user) {
                await supabase
                    .from('notifications')
                    .update({ read: true })
                    .eq('id', id)
                    .catch(() => {});
            }
        }
    },

    async markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.updateBadge();
        this.render();

        if (state.user) {
            await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', state.user.id)
                .catch(() => {});
        }
    },

    showToastNotification(notification) {
        showToast('🔔', notification.title, notification.message, null, null, 'info');
    },

    init() {
        this.load();

        // Toggle panel
        document.getElementById('notificationBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('notificationPanel')?.classList.toggle('show');
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#notificationPanel') && !e.target.closest('#notificationBtn')) {
                document.getElementById('notificationPanel')?.classList.remove('show');
            }
        });

        // Mark as read on click
        document.getElementById('notificationList')?.addEventListener('click', (e) => {
            const item = e.target.closest('.notification-item');
            if (item) {
                this.markAsRead(parseInt(item.dataset.id));
            }
        });

        // Mark all as read
        document.getElementById('markAllReadBtn')?.addEventListener('click', () => {
            this.markAllAsRead();
        });
    }
};

// ============================================================
// 7. DYNAMIC PRICING ENGINE
// ============================================================
const DynamicPricing = {
    async calculatePrice(productId, quantity, supplierId) {
        // Get base price
        const { data: product } = await supabase
            .from('products')
            .select('price, unit')
            .eq('id', productId)
            .single();

        if (!product) return null;

        // Get supplier-specific pricing tiers
        const { data: tiers } = await supabase
            .from('supplier_pricing')
            .select('*')
            .eq('product_id', productId)
            .eq('supplier_id', supplierId)
            .eq('is_active', true)
            .lte('min_quantity', quantity)
            .gte('max_quantity', quantity);

        if (tiers?.length) {
            return {
                unitPrice: tiers[0].unit_price,
                totalPrice: tiers[0].unit_price * quantity,
                currency: tiers[0].currency,
                tier: tiers[0]
            };
        }

        // Volume discounts
        const volumeDiscounts = [
            { minQty: 1000, discount: 0.15 },
            { minQty: 500, discount: 0.10 },
            { minQty: 100, discount: 0.05 },
            { minQty: 50, discount: 0.02 },
        ];

        const applicableDiscount = volumeDiscounts.find(d => quantity >= d.minQty);
        const discount = applicableDiscount?.discount || 0;
        
        const unitPrice = product.price * (1 - discount);
        
        return {
            unitPrice,
            totalPrice: unitPrice * quantity,
            currency: 'EGP',
            discount: discount * 100,
            tier: null
        };
    },

    renderPricingTiers(basePrice) {
        const tiers = [
            { min: 1, max: 49, discount: 0 },
            { min: 50, max: 99, discount: 2 },
            { min: 100, max: 499, discount: 5 },
            { min: 500, max: 999, discount: 10 },
            { min: 1000, max: null, discount: 15 },
        ];

        return `
            <div style="background: var(--c-surface-2); border-radius: 12px; padding: 16px; margin: 16px 0;">
                <div style="font-weight: 700; margin-bottom: 12px; font-size: 0.9rem;">
                    💰 خصومات الكميات
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${tiers.map(tier => {
                        const price = basePrice * (1 - tier.discount / 100);
                        return `
                            <div style="flex: 1; min-width: 100px; text-align: center; padding: 8px; background: ${tier.discount > 0 ? 'rgba(0,168,107,0.1)' : 'transparent'}; border-radius: 8px;">
                                <div style="font-size: 0.7rem; color: var(--c-text-sub);">
                                    ${tier.min}${tier.max ? `-${tier.max}` : '+'}
                                </div>
                                <div style="font-weight: 800; color: ${tier.discount > 0 ? 'var(--c-lab-green)' : 'var(--c-text)'};">
                                    ${price.toFixed(2)}
                                </div>
                                ${tier.discount > 0 ? `<div style="font-size: 0.65rem; color: var(--c-lab-green);">خصم ${tier.discount}%</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
};

// ============================================================
// 8. INITIALIZATION
// ============================================================
const initEnterprise = () => {
    console.log('🚀 كيماتو 3.0 Enterprise initializing...');
    
    CommodityTracker.init();
    MolecularVisualizer.init();
    SmartNotifications.init();

    // Initialize semantic search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' && e.shiftKey) {
                // Shift+Enter = AI Search
                e.preventDefault();
                const { query, filters } = SemanticSearch.parseNaturalLanguage(e.target.value);
                const results = await SemanticSearch.search(query, filters);
                renderProducts(results);
                
                showToast('🤖', 'بحث ذكي', `تم العثور على ${results.length} نتيجة`, null, null, 'info');
            }
        });
    }

    console.log('✅ كيماتو 3.0 Enterprise ready');
};

// Auto-init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initEnterprise, 1000));
} else {
    setTimeout(initEnterprise, 1000);
}