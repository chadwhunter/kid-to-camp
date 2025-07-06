// js/bookings.js - Clean Booking List (No Sample Data)

class BookingList {
    constructor() {
        this.bookings = [];
        this.filteredBookings = [];
        this.children = [];
        this.supabase = window.supabase;
        this.currentUser = null;
        this.init();
    }

    init() {
        console.log('Initializing BookingList...');
        this.loadData();
        this.setupEventListeners();
    }

    async loadData() {
        try {
            console.log('Loading booking data...');

            // Wait for auth state
            await this.waitForAuth();

            if (!this.currentUser) {
                console.log('No user found, redirecting to login...');
                window.location.href = '/login.html';
                return;
            }

            console.log('Loading data for user:', this.currentUser.email);

            await Promise.all([
                this.loadBookings(),
                this.loadChildren()
            ]);

            this.populateFilters();
            this.renderBookings();

        } catch (error) {
            console.error('Error loading booking data:', error);
            this.showError('Failed to load bookings. Please refresh the page.');
        }
    }

    async waitForAuth() {
        // Wait for supabase to be available
        let attempts = 0;
        while (!this.supabase && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            this.supabase = window.supabase;
            attempts++;
        }

        if (!this.supabase) {
            throw new Error('Supabase not available');
        }

        // Get current user
        const { data: { user }, error } = await this.supabase.auth.getUser();
        if (error) {
            console.error('Error getting user:', error);
            return;
        }

        this.currentUser = user;
        console.log('Current user:', user?.email);
    }

    async loadBookings() {
        try {
            if (!this.currentUser) {
                this.bookings = [];
                this.filteredBookings = [];
                return;
            }

            console.log('Fetching bookings from database...');

            // Try the full query with joins
            const { data: bookings, error } = await this.supabase
                .from('bookings')
                .select(`
                    *,
                    child_profiles!inner(
                        id,
                        name,
                        parent_id
                    ),
                    camp_schedules!inner(
                        id,
                        start_date,
                        end_date,
                        cost,
                        camps!inner(
                            id,
                            name,
                            description
                        )
                    )
                `)
                .eq('child_profiles.parent_id', this.currentUser.id)
                .order('camp_schedules.start_date', { ascending: true });

            if (error) {
                console.error('Error fetching bookings:', error);
                this.bookings = [];
                this.filteredBookings = [];
                return;
            }

            console.log('Raw bookings data:', bookings);

            if (!bookings || bookings.length === 0) {
                console.log('No bookings found for user');
                this.bookings = [];
                this.filteredBookings = [];
                return;
            }

            // Transform data for easier use
            this.bookings = bookings.map(booking => ({
                id: booking.id,
                child_id: booking.child_profiles?.id || booking.child_id,
                child_name: booking.child_profiles?.name || 'Unknown Child',
                camp_id: booking.camp_schedules?.camps?.id || 'unknown',
                camp_name: booking.camp_schedules?.camps?.name || 'Unknown Camp',
                camp_description: booking.camp_schedules?.camps?.description || '',
                start_date: booking.camp_schedules?.start_date,
                end_date: booking.camp_schedules?.end_date,
                cost: booking.camp_schedules?.cost || 0,
                status: booking.status || 'confirmed',
                created_at: booking.created_at
            }));

            this.filteredBookings = [...this.bookings];
            console.log('Processed bookings:', this.bookings);

        } catch (error) {
            console.error('Error loading bookings:', error);
            this.bookings = [];
            this.filteredBookings = [];
        }
    }

    async loadChildren() {
        try {
            if (!this.currentUser) {
                this.children = [];
                return;
            }

            console.log('Fetching children from database...');

            const { data: children, error } = await this.supabase
                .from('child_profiles')
                .select('id, name')
                .eq('parent_id', this.currentUser.id)
                .order('name');

            if (error) {
                console.error('Error loading children:', error);
                this.children = [];
                return;
            }

            this.children = children || [];
            console.log('Children loaded:', this.children);

        } catch (error) {
            console.error('Error loading children:', error);
            this.children = [];
        }
    }

    populateFilters() {
        const childFilter = document.getElementById('childFilter');
        if (!childFilter) return;

        // Clear existing options except "All Children"
        childFilter.innerHTML = '<option value="">All Children</option>';

        // Get unique child names from bookings if no children data
        const childNames = this.children.length > 0
            ? this.children.map(child => child.name)
            : [...new Set(this.bookings.map(booking => booking.child_name))];

        childNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            childFilter.appendChild(option);
        });
    }

    setupEventListeners() {
        const filters = ['childFilter', 'statusFilter', 'dateFilter'];

        filters.forEach(filterId => {
            const filterElement = document.getElementById(filterId);
            if (filterElement) {
                filterElement.addEventListener('change', () => {
                    this.applyFilters();
                });
            }
        });

        // Handle action buttons with event delegation
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-danger') && e.target.textContent.trim() === 'Cancel') {
                this.handleCancelBooking(e.target);
            } else if (e.target.classList.contains('btn-info') && e.target.textContent.trim() === 'View') {
                this.handleViewBooking(e.target);
            }
        });
    }

    applyFilters() {
        const childFilter = document.getElementById('childFilter')?.value || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';
        const dateFilter = document.getElementById('dateFilter')?.value || '';

        this.filteredBookings = this.bookings.filter(booking => {
            let matches = true;

            // Child filter
            if (childFilter && booking.child_name !== childFilter) {
                matches = false;
            }

            // Status filter
            if (statusFilter && booking.status !== statusFilter) {
                matches = false;
            }

            // Date filter
            if (dateFilter) {
                const bookingStartDate = new Date(booking.start_date);
                const bookingEndDate = new Date(booking.end_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                switch (dateFilter) {
                    case 'upcoming':
                        matches = matches && bookingStartDate > today;
                        break;
                    case 'past':
                        matches = matches && bookingEndDate < today;
                        break;
                    case 'current':
                        matches = matches && bookingStartDate <= today && bookingEndDate >= today;
                        break;
                }
            }

            return matches;
        });

        this.renderBookings();
    }

    renderBookings() {
        const tableBody = document.getElementById('bookingTableBody');
        const emptyState = document.getElementById('emptyState');
        const tableContainer = document.getElementById('bookingTableContainer');

        if (!tableBody || !emptyState || !tableContainer) {
            console.error('Required DOM elements not found');
            return;
        }

        if (this.filteredBookings.length === 0) {
            tableContainer.style.display = 'none';
            emptyState.style.display = 'block';
            this.updateTotals();
            return;
        }

        tableContainer.style.display = 'block';
        emptyState.style.display = 'none';

        tableBody.innerHTML = this.filteredBookings.map(booking => {
            const startDate = new Date(booking.start_date);
            const endDate = new Date(booking.end_date);
            const dateRange = this.formatDateRange(startDate, endDate);

            return `
                <tr data-booking-id="${booking.id}">
                    <td><span class="child-tag">${booking.child_name}</span></td>
                    <td>
                        <div>
                            <strong>${booking.camp_name}</strong>
                            ${booking.camp_description ? `<br><small style="color: #666;">${booking.camp_description}</small>` : ''}
                        </div>
                    </td>
                    <td>${dateRange}</td>
                    <td><span class="status-badge status-${booking.status}">${this.capitalizeFirst(booking.status)}</span></td>
                    <td class="cost-cell">$${booking.cost}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-small btn-info" title="View booking details">View</button>
                            <button class="btn btn-small btn-danger" title="Cancel booking">Cancel</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        this.updateTotals();
    }

    formatDateRange(startDate, endDate) {
        const options = { month: 'short', day: 'numeric' };
        const start = startDate.toLocaleDateString('en-US', options);
        const end = endDate.toLocaleDateString('en-US', options);
        const year = startDate.getFullYear();

        if (startDate.toDateString() === endDate.toDateString()) {
            return `${start}, ${year}`;
        }

        if (startDate.getMonth() === endDate.getMonth()) {
            return `${start.split(' ')[0]} ${start.split(' ')[1]}-${end.split(' ')[1]}, ${year}`;
        }

        return `${start}-${end}, ${year}`;
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    updateTotals() {
        const totalBookings = document.getElementById('totalBookings');
        const totalCost = document.getElementById('totalCost');

        if (totalBookings && totalCost) {
            const count = this.filteredBookings.length;
            const cost = this.filteredBookings.reduce((sum, booking) => sum + parseFloat(booking.cost || 0), 0);

            totalBookings.textContent = count;
            totalCost.textContent = cost.toFixed(2);
        }
    }

    handleViewBooking(button) {
        const row = button.closest('tr');
        const bookingId = row.dataset.bookingId;
        const booking = this.bookings.find(b => b.id == bookingId);

        if (booking) {
            this.showBookingDetails(booking);
        }
    }

    showBookingDetails(booking) {
        const details = `
Booking Details:
━━━━━━━━━━━━━━━━━━━━
Child: ${booking.child_name}
Camp: ${booking.camp_name}
${booking.camp_description ? `Description: ${booking.camp_description}` : ''}
Dates: ${this.formatDateRange(new Date(booking.start_date), new Date(booking.end_date))}
Status: ${this.capitalizeFirst(booking.status)}
Cost: $${booking.cost}
Booked: ${new Date(booking.created_at).toLocaleDateString()}
        `;

        alert(details);
    }

    async handleCancelBooking(button) {
        const row = button.closest('tr');
        const bookingId = row.dataset.bookingId;
        const booking = this.bookings.find(b => b.id == bookingId);

        if (!booking) return;

        const confirmMessage = `Are you sure you want to cancel the booking for ${booking.child_name} at ${booking.camp_name}?

This action cannot be undone and cancellation policies may apply.`;

        if (confirm(confirmMessage)) {
            try {
                button.disabled = true;
                button.textContent = 'Cancelling...';

                // Delete booking from database
                const { error } = await this.supabase
                    .from('bookings')
                    .delete()
                    .eq('id', bookingId);

                if (error) throw error;

                // Remove from local arrays
                this.bookings = this.bookings.filter(b => b.id !== parseInt(bookingId));
                this.filteredBookings = this.filteredBookings.filter(b => b.id !== parseInt(bookingId));

                // Re-render
                this.renderBookings();

                // Show success message
                this.showSuccess('Booking cancelled successfully');

            } catch (error) {
                console.error('Error cancelling booking:', error);
                this.showError('Failed to cancel booking. Please try again.');

                // Reset button
                button.disabled = false;
                button.textContent = 'Cancel';
            }
        }
    }

    showError(message) {
        console.error('Error:', message);
        alert('Error: ' + message);
    }

    showSuccess(message) {
        console.log('Success:', message);
        alert('Success: ' + message);
    }

    // Public method to refresh data
    async refresh() {
        await this.loadData();
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the bookings page
    if (window.location.pathname.includes('bookings.html') ||
        document.getElementById('bookingTableBody')) {
        console.log('Initializing BookingList...');
        window.bookingList = new BookingList();
    }
});

// Export for use in other files if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BookingList;
}