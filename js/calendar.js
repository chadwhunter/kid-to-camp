// Family Calendar functionality
class FamilyCalendar {
    constructor() {
        // Default to current date
        this.currentDate = new Date();
        this.currentView = 'month';
        this.bookings = [];
        this.camps = [];
        this.childColors = {};
        this.currentBooking = null;

        // Predefined colors for children
        this.CHILD_COLORS = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#FFB6C1', '#87CEEB', '#F0E68C', '#FFA07A'
        ];

        console.log('FamilyCalendar constructor - Current date set to:', this.currentDate);
    }

    async init() {
        console.log('Calendar init started...');

        // Wait for KidToCamp to be initialized
        if (!window.kidToCamp || !kidToCamp.supabase) {
            console.log('KidToCamp not ready, waiting...');
            setTimeout(() => this.init(), 100);
            return;
        }

        console.log('KidToCamp is ready, checking session...');

        // Check for existing session
        const { data: { session } } = await kidToCamp.supabase.auth.getSession();

        if (!session) {
            console.log('No session found, redirecting to home');
            window.location.href = 'index.html';
            return;
        }

        console.log('Session found, user:', session.user.email);

        // Set current user if not already set
        if (!kidToCamp.currentUser) {
            kidToCamp.currentUser = session.user;
        }

        // Load data
        console.log('Loading calendar data...');
        await this.loadData();

        console.log('Assigning child colors...');
        this.assignChildColors();

        console.log('Rendering calendar...');
        this.render();

        console.log('Setting up event listeners...');
        this.setupEventListeners();

        console.log('Calendar initialization complete!');
    }

    async loadData() {
        try {
            console.log('Loading user data...');
            // Load user data if not already loaded
            if (!kidToCamp.children || kidToCamp.children.length === 0) {
                await kidToCamp.loadUserData();
            }
            console.log('Children loaded:', kidToCamp.children?.length || 0);

            // Load bookings (don't fail if none exist)
            console.log('Loading bookings...');
            await this.loadBookings();
            console.log('Bookings loaded:', this.bookings.length);

            // Load camps (don't fail if none exist)
            console.log('Loading camps...');
            await this.loadCamps();
            console.log('Camps loaded:', this.camps.length);

        } catch (error) {
            console.error('Error loading calendar data:', error);
            // Don't show error for empty data - calendar should still work
            console.log('Calendar will display with available data');
        }
    }

    async loadBookings() {
        try {
            // Simple query first - no joins since foreign keys aren't set up
            const { data: bookings, error } = await kidToCamp.supabase
                .from('bookings')
                .select('*')
                .eq('parent_id', kidToCamp.currentUser.id);

            if (error) {
                throw error;
            }

            this.bookings = bookings || [];

            // If we have bookings, manually fetch related data
            if (this.bookings.length > 0) {
                for (let booking of this.bookings) {
                    try {
                        // Get child info
                        const { data: child } = await kidToCamp.supabase
                            .from('child_profiles')
                            .select('first_name, last_name')
                            .eq('id', booking.child_id)
                            .single();
                        booking.child_profiles = child;

                        // Get camp info
                        const { data: camp } = await kidToCamp.supabase
                            .from('camps')
                            .select('name, location')
                            .eq('id', booking.camp_id)
                            .single();
                        booking.camps = camp;

                        // Get schedule info
                        const { data: schedule } = await kidToCamp.supabase
                            .from('camp_schedules')
                            .select('start_date, end_date, start_time, end_time, days_of_week')
                            .eq('id', booking.schedule_id)
                            .single();
                        booking.camp_schedules = schedule;
                    } catch (relatedError) {
                        console.warn('Error loading related data for booking:', booking.id, relatedError);
                    }
                }
            }

            console.log('Bookings loaded successfully:', this.bookings.length);

            // Debug: Log first booking to see structure
            if (this.bookings.length > 0) {
                console.log('Sample booking structure:', this.bookings[0]);
                console.log('All booking dates:', this.bookings.map(b => ({
                    id: b.id,
                    child: b.child_profiles?.first_name,
                    camp: b.camps?.name,
                    startDate: b.camp_schedules?.start_date,
                    endDate: b.camp_schedules?.end_date,
                    daysOfWeek: b.camp_schedules?.days_of_week
                })));
            }

        } catch (error) {
            console.error('Error loading bookings:', error);
            this.bookings = [];
        }
    }

    async loadCamps() {
        try {
            // Simple query without the 'price' column since it doesn't exist
            const { data: camps, error } = await kidToCamp.supabase
                .from('camps')
                .select('id, name, location')
                .order('name');

            if (error) {
                throw error;
            }

            this.camps = camps || [];

            // If we have camps, manually fetch their schedules
            if (this.camps.length > 0) {
                for (let camp of this.camps) {
                    try {
                        const { data: schedules } = await kidToCamp.supabase
                            .from('camp_schedules')
                            .select('id, start_date, end_date, start_time, end_time, available_spots')
                            .eq('camp_id', camp.id);
                        camp.camp_schedules = schedules || [];
                    } catch (scheduleError) {
                        console.warn('Error loading schedules for camp:', camp.id, scheduleError);
                        camp.camp_schedules = [];
                    }
                }
            }

            console.log('Camps loaded successfully:', this.camps.length);

        } catch (error) {
            console.error('Error loading camps:', error);
            this.camps = [];
        }
    }

    assignChildColors() {
        // Only assign colors if there are children
        if (kidToCamp.children && kidToCamp.children.length > 0) {
            kidToCamp.children.forEach((child, index) => {
                if (!this.childColors[child.id]) {
                    this.childColors[child.id] = this.CHILD_COLORS[index % this.CHILD_COLORS.length];
                }
            });
        }
    }

    setupEventListeners() {
        // Booking form submission
        document.getElementById('bookingForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddBooking();
        });

        // Modal close on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.ui.closeModal(e.target.id);
            }
        });
    }

    render() {
        this.updatePeriodDisplay();
        this.renderChildrenLegend();

        if (this.currentView === 'month') {
            this.renderMonthView();
        } else {
            this.renderWeekView();
        }
    }

    updatePeriodDisplay() {
        const periodElement = document.getElementById('currentPeriod');

        if (this.currentView === 'month') {
            const monthYear = this.currentDate.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
            });
            periodElement.textContent = monthYear;
        } else {
            const startOfWeek = this.getStartOfWeek(this.currentDate);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 6);

            const weekRange = `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            periodElement.textContent = weekRange;
        }
    }

    renderChildrenLegend() {
        const legendContainer = document.getElementById('childrenLegend');

        if (!kidToCamp.children || kidToCamp.children.length === 0) {
            legendContainer.innerHTML = `
                <div class="empty-legend">
                    <p>📝 No children added yet. <a href="profile.html">Add children to your profile</a> to start booking camps!</p>
                </div>
            `;
            return;
        }

        const legendHTML = kidToCamp.children.map(child => {
            const color = this.childColors[child.id];
            const bookingCount = this.bookings.filter(b => b.child_id === child.id).length;
            return `
                <div class="child-legend-item">
                    <div class="color-indicator" style="background-color: ${color}"></div>
                    <span>${child.first_name} ${child.last_name}</span>
                    <small style="opacity: 0.7; margin-left: 0.5rem;">(${bookingCount} booking${bookingCount !== 1 ? 's' : ''})</small>
                </div>
            `;
        }).join('');

        legendContainer.innerHTML = legendHTML;
    }

    renderMonthView() {
        const headerContainer = document.getElementById('calendarHeader');
        const gridContainer = document.getElementById('calendarGrid');

        // Render day headers
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        headerContainer.innerHTML = dayHeaders.map(day =>
            `<div class="day-header">${day}</div>`
        ).join('');

        // Get month data
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        // Render calendar grid
        let gridHTML = '';
        let currentDate = new Date(startDate);

        for (let week = 0; week < 6; week++) {
            for (let day = 0; day < 7; day++) {
                const isCurrentMonth = currentDate.getMonth() === month;
                const isToday = this.isToday(currentDate);
                const dayBookings = this.getBookingsForDate(currentDate);

                // Create a proper date string for the onclick handler (fixing timezone issue here too)
                const yearStr = currentDate.getFullYear();
                const monthStr = String(currentDate.getMonth() + 1).padStart(2, '0');
                const dayStr = String(currentDate.getDate()).padStart(2, '0');
                const dateStr = `${yearStr}-${monthStr}-${dayStr}`;

                // Debug logging for first week of July
                if (currentDate.getFullYear() === 2025 && currentDate.getMonth() === 6 && currentDate.getDate() <= 12) {
                    console.log(`📅 Rendering calendar day ${currentDate.getDate()}: dateStr=${dateStr}, bookings=${dayBookings.length}`);
                }

                gridHTML += `
                    <div class="calendar-day ${isCurrentMonth ? 'current-month' : 'other-month'} ${isToday ? 'today' : ''}"
                         onclick="familyCalendar.handleDayClick('${dateStr}')">
                        <div class="day-number">${currentDate.getDate()}</div>
                        <div class="day-bookings">
                            ${this.renderDayBookings(dayBookings)}
                        </div>
                    </div>
                `;

                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        gridContainer.innerHTML = gridHTML;
    }

    renderWeekView() {
        const headerContainer = document.getElementById('calendarHeader');
        const gridContainer = document.getElementById('calendarGrid');

        const startOfWeek = this.getStartOfWeek(this.currentDate);
        const dayHeaders = [];
        const currentDate = new Date(startOfWeek);

        // Create day headers for week view
        for (let i = 0; i < 7; i++) {
            const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNumber = currentDate.getDate();
            dayHeaders.push(`
                <div class="day-header week-header">
                    <div>${dayName}</div>
                    <div class="day-number">${dayNumber}</div>
                </div>
            `);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        headerContainer.innerHTML = dayHeaders.join('');

        // Render week grid
        currentDate.setTime(startOfWeek.getTime());
        let gridHTML = '';

        for (let i = 0; i < 7; i++) {
            const isToday = this.isToday(currentDate);
            const dayBookings = this.getBookingsForDate(currentDate);

            gridHTML += `
                <div class="calendar-day week-day ${isToday ? 'today' : ''}"
                     onclick="familyCalendar.handleDayClick('${currentDate.toISOString().split('T')[0]}')">
                    <div class="week-day-bookings">
                        ${this.renderWeekDayBookings(dayBookings)}
                    </div>
                </div>
            `;

            currentDate.setDate(currentDate.getDate() + 1);
        }

        gridContainer.innerHTML = gridHTML;
    }

    renderDayBookings(bookings) {
        if (!bookings || bookings.length === 0) {
            return '';
        }

        return bookings.map(booking => {
            const child = kidToCamp.children?.find(c => c.id === booking.child_id);
            const color = this.childColors[booking.child_id] || '#ccc';

            return `
                <div class="booking-item" 
                     style="background-color: ${color}; color: white;"
                     onclick="event.stopPropagation(); familyCalendar.showBookingDetails('${booking.id}')"
                     title="${child?.first_name || 'Child'} - ${booking.camps?.name || 'Camp'}">
                    ${child?.first_name || 'Booking'}
                </div>
            `;
        }).join('');
    }

    renderWeekDayBookings(bookings) {
        if (!bookings || bookings.length === 0) {
            return '';
        }

        return bookings.map(booking => {
            const child = kidToCamp.children?.find(c => c.id === booking.child_id);
            const color = this.childColors[booking.child_id] || '#ccc';

            return `
                <div class="week-booking-item" 
                     style="background-color: ${color}; color: white;"
                     onclick="event.stopPropagation(); familyCalendar.showBookingDetails('${booking.id}')"
                     title="${child?.first_name || 'Child'} - ${booking.camps?.name || 'Camp'}">
                    <div class="booking-child">${child?.first_name || 'Child'}</div>
                    <div class="booking-camp">${booking.camps?.name || 'Camp'}</div>
                </div>
            `;
        }).join('');
    }

    getBookingsForDate(date) {
        // Fix timezone issue - use local date string instead of ISO string
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const matchingBookings = this.bookings.filter(booking => {
            if (!booking.camp_schedules) {
                console.log('Booking missing schedule:', booking.id);
                return false;
            }

            const schedule = booking.camp_schedules;
            const startDate = schedule.start_date;
            const endDate = schedule.end_date;

            // Debug logging for the first few days of July
            if (dateStr >= '2025-07-06' && dateStr <= '2025-07-12') {
                console.log(`🔍 Checking ${dateStr} against booking:`, {
                    bookingId: booking.id,
                    child: booking.child_profiles?.first_name,
                    camp: booking.camps?.name,
                    startDate,
                    endDate,
                    dateInRange: dateStr >= startDate && dateStr <= endDate
                });
            }

            // Check if date falls within the schedule range
            if (dateStr >= startDate && dateStr <= endDate) {
                // TEMPORARY: Disable days_of_week check to show bookings
                // TODO: Fix the days_of_week array comparison

                if (dateStr >= '2025-07-06' && dateStr <= '2025-07-12') {
                    console.log(`✅ MATCH FOUND for ${dateStr}: ${booking.child_profiles?.first_name} at ${booking.camps?.name}`);
                }
                return true;

                /* ORIGINAL CODE - COMMENTED OUT FOR NOW
                // If days_of_week is specified, check if current day matches
                if (schedule.days_of_week && schedule.days_of_week.length > 0) {
                    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
                    
                    // Handle case where days_of_week might be a string instead of array
                    let daysArray = schedule.days_of_week;
                    if (typeof daysArray === 'string') {
                        daysArray = daysArray.split(',').map(d => parseInt(d.trim()));
                    }
                    
                    const dayMatches = daysArray.includes(dayOfWeek);
                    
                    if (dateStr === '2025-07-07' || dateStr === '2025-07-08' || dateStr === '2025-07-09') {
                        console.log(`Day check for ${dateStr}:`, {
                            dayOfWeek,
                            daysArray,
                            arrayType: typeof daysArray,
                            arrayIsArray: Array.isArray(daysArray),
                            arrayContents: JSON.stringify(daysArray),
                            firstElement: daysArray[0],
                            firstElementType: typeof daysArray[0],
                            includes: daysArray.includes(dayOfWeek),
                            indexOfDay: daysArray.indexOf(dayOfWeek)
                        });
                    }
                    
                    return dayMatches;
                }
                // If no days_of_week specified, assume all days in range
                return true;
                */
            }
            return false;
        });

        if (matchingBookings.length > 0 && (dateStr === '2025-07-07' || dateStr === '2025-07-08' || dateStr === '2025-07-09')) {
            console.log(`Found ${matchingBookings.length} bookings for ${dateStr}:`, matchingBookings);
        }

        return matchingBookings;
    }

    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    }

    getStartOfWeek(date) {
        const result = new Date(date);
        result.setDate(result.getDate() - result.getDay());
        return result;
    }

    // Navigation methods
    setView(view) {
        this.currentView = view;

        // Update button states
        document.getElementById('monthViewBtn').classList.toggle('active', view === 'month');
        document.getElementById('weekViewBtn').classList.toggle('active', view === 'week');

        this.render();
    }

    previousPeriod() {
        if (this.currentView === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        } else {
            this.currentDate.setDate(this.currentDate.getDate() - 7);
        }
        this.render();
    }

    nextPeriod() {
        if (this.currentView === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        } else {
            this.currentDate.setDate(this.currentDate.getDate() + 7);
        }
        this.render();
    }

    goToToday() {
        this.currentDate = new Date();
        this.render();
    }

    // Event handlers
    handleDayClick(dateStr) {
        // Store the selected date for when the modal opens
        this.selectedDate = dateStr;
        this.showAddBooking();
    }

    showAddBooking() {
        // Check if we have children first
        if (!kidToCamp.children || kidToCamp.children.length === 0) {
            kidToCamp.ui?.showMessage('Please add children to your profile first before booking camps.', 'error');
            setTimeout(() => {
                window.location.href = 'profile.html';
            }, 2000);
            return;
        }

        // Check if we have camps
        if (!this.camps || this.camps.length === 0) {
            kidToCamp.ui?.showMessage('No camps are currently available for booking.', 'error');
            return;
        }

        // Populate children dropdown
        const childSelect = document.getElementById('bookingChild');
        if (childSelect) {
            childSelect.innerHTML = '<option value="">Select a child...</option>';

            kidToCamp.children.forEach(child => {
                const option = document.createElement('option');
                option.value = child.id;
                option.textContent = `${child.first_name} ${child.last_name}`;
                childSelect.appendChild(option);
            });
        }

        // Populate camp schedules dropdown
        const campSelect = document.getElementById('bookingCamp');
        if (campSelect) {
            campSelect.innerHTML = '<option value="">Select a camp session...</option>';

            this.camps.forEach(camp => {
                if (camp.camp_schedules && camp.camp_schedules.length > 0) {
                    camp.camp_schedules.forEach(schedule => {
                        const option = document.createElement('option');
                        option.value = schedule.id;
                        const startDate = new Date(schedule.start_date).toLocaleDateString();
                        const endDate = new Date(schedule.end_date).toLocaleDateString();
                        const timeInfo = schedule.start_time ? ` (${schedule.start_time} - ${schedule.end_time})` : '';
                        const spotsInfo = schedule.available_spots ? ` (${schedule.available_spots} spots)` : '';
                        option.textContent = `${camp.name} - ${startDate} to ${endDate}${timeInfo}${spotsInfo}`;
                        campSelect.appendChild(option);
                    });
                }
            });

            // Show message if no camp sessions available
            if (campSelect.children.length === 1) {
                campSelect.innerHTML = '<option value="">No camp sessions currently available</option>';
            }
        }

        // Open the modal
        this.ui.openModal('addBookingModal');

        // Set the selected date if we have one (from day click)
        if (this.selectedDate) {
            const startDateInput = document.getElementById('bookingStartDate');
            const endDateInput = document.getElementById('bookingEndDate');

            // Note: These inputs don't exist in the current form since we removed them
            // This is for future use if you want to add date inputs back
            if (startDateInput) startDateInput.value = this.selectedDate;
            if (endDateInput) endDateInput.value = this.selectedDate;
        }
    }

    async handleAddBooking() {
        const scheduleId = document.getElementById('bookingCamp').value;

        // Find the selected camp and schedule for camp_id
        let selectedCampId = null;
        for (const camp of this.camps) {
            if (camp.camp_schedules) {
                const schedule = camp.camp_schedules.find(s => s.id === scheduleId);
                if (schedule) {
                    selectedCampId = camp.id;
                    break;
                }
            }
        }

        if (!selectedCampId) {
            kidToCamp.ui.showMessage('Invalid camp selection', 'error');
            return;
        }

        const bookingData = {
            parent_id: kidToCamp.currentUser.id,
            child_id: document.getElementById('bookingChild').value,
            camp_id: selectedCampId,
            schedule_id: scheduleId,
            status: 'confirmed'
        };

        try {
            const { error } = await kidToCamp.supabase
                .from('bookings')
                .insert(bookingData);

            if (error) throw error;

            kidToCamp.ui.showMessage('Booking added successfully!', 'success');
            this.ui.closeModal('addBookingModal');
            await this.loadBookings();
            this.render();

        } catch (error) {
            console.error('Error adding booking:', error);
            kidToCamp.ui.showMessage(error.message, 'error');
        }
    }

    showBookingDetails(bookingId) {
        const booking = this.bookings.find(b => b.id === bookingId);
        if (!booking) return;

        this.currentBooking = booking;
        const child = kidToCamp.children.find(c => c.id === booking.child_id);
        const color = this.childColors[booking.child_id];
        const schedule = booking.camp_schedules;

        const timeInfo = schedule.start_time && schedule.end_time
            ? `${schedule.start_time} - ${schedule.end_time}`
            : 'All day';

        const daysInfo = schedule.days_of_week && schedule.days_of_week.length > 0
            ? this.formatDaysOfWeek(schedule.days_of_week)
            : 'Every day';

        const detailsHTML = `
            <div class="booking-details">
                <div class="booking-header" style="background-color: ${color}; color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <h3>${child?.first_name} ${child?.last_name}</h3>
                    <p>${booking.camps?.name}</p>
                </div>
                
                <div class="booking-info">
                    <div class="info-item">
                        <strong>Camp:</strong> ${booking.camps?.name}
                    </div>
                    <div class="info-item">
                        <strong>Location:</strong> ${booking.camps?.location}
                    </div>
                    <div class="info-item">
                        <strong>Start Date:</strong> ${new Date(schedule.start_date).toLocaleDateString()}
                    </div>
                    <div class="info-item">
                        <strong>End Date:</strong> ${new Date(schedule.end_date).toLocaleDateString()}
                    </div>
                    <div class="info-item">
                        <strong>Time:</strong> ${timeInfo}
                    </div>
                    <div class="info-item">
                        <strong>Schedule:</strong> ${daysInfo}
                    </div>
                    <div class="info-item">
                        <strong>Status:</strong> <span class="status-badge ${booking.status}">${booking.status}</span>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('bookingDetailsContent').innerHTML = detailsHTML;
        this.ui.openModal('bookingDetailsModal');
    }

    formatDaysOfWeek(daysArray) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return daysArray.map(day => dayNames[day]).join(', ');
    }

    async deleteCurrentBooking() {
        if (!this.currentBooking) return;

        if (!confirm('Are you sure you want to delete this booking? This cannot be undone.')) {
            return;
        }

        try {
            const { error } = await kidToCamp.supabase
                .from('bookings')
                .delete()
                .eq('id', this.currentBooking.id);

            if (error) throw error;

            kidToCamp.ui.showMessage('Booking deleted successfully', 'success');
            this.ui.closeModal('bookingDetailsModal');
            await this.loadBookings();
            this.render();

        } catch (error) {
            console.error('Error deleting booking:', error);
            kidToCamp.ui.showMessage(error.message, 'error');
        }
    }
}

// UI Helper Methods
FamilyCalendar.prototype.ui = {
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }

        // Reset forms when closing
        if (modalId === 'addBookingModal') {
            document.getElementById('bookingForm').reset();
        }
    }
};

// Initialize calendar - simplified approach
let familyCalendar;
let initAttempts = 0;
const MAX_ATTEMPTS = 30;

const initFamilyCalendar = () => {
    initAttempts++;

    if (initAttempts > MAX_ATTEMPTS) {
        console.error('❌ Calendar initialization failed');
        return;
    }

    // Check if we have everything we need
    if (!window.kidToCamp || !window.kidToCamp.supabase) {
        console.log(`⏳ Waiting for dependencies... (${initAttempts}/${MAX_ATTEMPTS})`);
        setTimeout(initFamilyCalendar, 200);
        return;
    }

    // Create and initialize calendar
    try {
        console.log('🎯 Creating calendar...');
        familyCalendar = new FamilyCalendar();
        window.familyCalendar = familyCalendar;

        familyCalendar.init().then(() => {
            console.log('✅ Calendar ready!');
        }).catch(error => {
            console.error('❌ Calendar init error:', error);
        });

    } catch (error) {
        console.error('❌ Calendar creation error:', error);
    }
};

// Start initialization when this script loads
console.log('📅 Calendar script loaded, starting initialization...');
initFamilyCalendar();