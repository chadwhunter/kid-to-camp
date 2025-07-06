// js/bookings.js - Booking List Management

class BookingList {
    constructor() {
        this.bookings = [];
        this.filteredBookings = [];
        this.children = [];
        this.supabase = window.supabase;
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
    }

    async loadData() {
        try {
            await this.loadBookings();
            await this.loadChildren();
            this.populateFilters();
            this.renderBookings();
        } catch (error) {
            console.error('Error loading booking data:', error);
            this.showError('Failed to load bookings. Please refresh the page.');
        }
    }

    async loadBookings() {
        try {
            // Get current user
            const { data: { user }, error: userError } = await this.supabase.auth.getUser();
            if (userError) throw userError;

            if (!user) {
                window.location.href = '/login.html';
                return;
            }

            // Fetch bookings with related data
            const { data: bookings, error } = await this.supabase
                .from('bookings')
                .select(`
                    *,
                    child_profiles!inner(
                        id,
                        name
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
                .eq('child_profiles.parent_id', user.id)
                .order('camp_schedules.start_date', { ascending: true });

            if (error) throw error;

            // Transform data for easier use
            this.bookings = bookings.map(booking => ({
                id: booking.id,
                child_id: booking.child_profiles.id,
                child_name: booking.child_profiles.name,
                camp_id: booking.camp_schedules.camps.id,
                camp_name: booking.camp_schedules.camps.name,
                camp_description: booking.camp_schedules.camps.description,
                start_date: booking.camp_schedules.start_date,
                end_date: booking.camp_schedules.end_date,
                cost: booking.camp_schedules.cost,
                status: booking.status || 'confirmed',
                created_at: booking.created_at
            }));

            this.filteredBookings = [...this.bookings];
        } catch (error) {
            console.error('Error loading bookings:', error);
            this.bookings = [];
            this.filteredBookings = [];
        }
    }

    async loadChildren() {
        try {
            // Get current user
            const { data: { user }, error: userError } = await this.supabase.auth.getUser();
            if (userError) throw userError;

            // Fetch children
            const { data: children, error } = await this.supabase
                .from('child_profiles')
                .select('id, name')
                .eq('parent_id', user.id)
                .order('name');

            if (error) throw error;

            this.children = children || [];
        } catch (error) {
            console.error('Error loading children:', error);
            this.children = [];
        }
    }

    populateFilters() {
        const childFilter = document.getElementById('childFilter');

        // Clear existing options except "All Children"
        childFilter.innerHTML = '<option value="">All Children</option>';

        this.children.forEach(child => {
            const option = document.createElement('option');
            option.value = child.name;
            option.textContent = child.name;
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
            if (e.target.classList.contains('btn-danger') && e.target.textContent === 'Cancel') {
                this.handleCancelBooking(e.target);
            } else if (e.target.classList.contains('btn-info') && e.target.textContent === 'View') {
                this.handleViewBooking(e.target);
            }
        });
    }

    applyFilters() {
        const childFilter = document.getElementById('childFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const dateFilter = document.getElementById('dateFilter').value;

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
                today.setHours(0, 0, 0, 0); // Reset time for accurate comparison

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

        // Same day
        if (startDate.toDateString() === endDate.toDateString()) {
            return `${start}, ${year}`;
        }

        // Same month
        if (startDate.getMonth() === endDate.getMonth()) {
            return `${start.split(' ')[0]} ${start.split(' ')[1]}-${end.split(' ')[1]}, ${year}`;
        }

        // Different months
        return `${start}-${end}, ${year}`;
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    updateTotals() {
        const totalBookings = document.getElementById('totalBookings');
        const totalCost = document.getElementById('totalCost');

        const count = this.filteredBookings.length;
        const cost = this.filteredBookings.reduce((sum, booking) => sum + parseFloat(booking.cost), 0);

        totalBookings.textContent = count;
        totalCost.textContent = cost.toFixed(2);
    }

    handleViewBooking(button) {
        const row = button.closest('tr');
        const bookingId = row.dataset.bookingId;
        const booking = this.bookings.find(b => b.id == bookingId);

        if (booking) {
            // Show booking details in modal or navigate to detail page
            this.showBookingDetails(booking);
        }
    }

    showBookingDetails(booking) {
        // Simple alert for now - you can implement a modal later
        const details = `
Booking Details:
- Child: ${booking.child_name}
- Camp: ${booking.camp_name}
- Dates: ${this.formatDateRange(new Date(booking.start_date), new Date(booking.end_date))}
- Status: ${this.capitalizeFirst(booking.status)}
- Cost: $${booking.cost}
- Booked: ${new Date(booking.created_at).toLocaleDateString()}
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
        // Simple alert for now - you can implement toast notifications later
        alert('Error: ' + message);
    }

    showSuccess(message) {
        // Simple alert for now - you can implement toast notifications later
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
        window.bookingList = new BookingList();
    }
});

// Export for use in other files if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BookingList;
}