< !DOCTYPE html >
    <html lang="en">

        <head>
            <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Camp Owner Dashboard - Kid To Camp</title>
                    <link rel="stylesheet" href="css/styles.css">
                    </head>

                    <body>
                        <!-- Navigation -->
                        <nav class="navbar">
                            <div class="nav-container">
                                <a href="/" class="logo">Kid To Camp</a>

                                <ul class="nav-links">
                                    <li><a href="/">Home</a></li>
                                    <li><a href="/camp-dashboard.html" class="active">Dashboard</a></li>
                                    <li><a href="/calendar.html">Calendar</a></li>
                                    <li><a href="/bookings.html">Bookings</a></li>
                                </ul>

                                <div id="navAuth">
                                    <!-- Will be populated by navigation.js -->
                                </div>
                            </div>
                        </nav>

                        <!-- Main Content -->
                        <div class="container">
                            <div class="page-header">
                                <h1>🏕️ Camp Owner Dashboard</h1>
                                <p>Manage your camps, schedules, and bookings</p>
                            </div>

                            <!-- Quick Stats -->
                            <div class="profile-section">
                                <div class="section-header">
                                    <h2>📊 Quick Stats</h2>
                                    <button class="btn btn-outline" onclick="refreshStats()">Refresh</button>
                                </div>
                                <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                                    <div class="action-card">
                                        <h3 id="campCount">-</h3>
                                        <p>Total Camps</p>
                                    </div>
                                    <div class="action-card">
                                        <h3 id="scheduleCount">-</h3>
                                        <p>Active Schedules</p>
                                    </div>
                                    <div class="action-card">
                                        <h3 id="bookingCount">-</h3>
                                        <p>Total Bookings</p>
                                    </div>
                                    <div class="action-card">
                                        <h3 id="revenueCount">$-</h3>
                                        <p>Total Revenue</p>
                                    </div>
                                </div>
                            </div>

                            <!-- My Camps -->
                            <div class="profile-section">
                                <div class="section-header">
                                    <h2>🏕️ My Camps</h2>
                                    <button class="btn btn-primary" onclick="showAddCamp()">+ Add New Camp</button>
                                </div>
                                <div id="campsList">
                                    <!-- Camps will be loaded here -->
                                </div>
                            </div>

                            <!-- Recent Bookings -->
                            <div class="profile-section">
                                <div class="section-header">
                                    <h2>📋 Recent Bookings</h2>
                                    <a href="/bookings.html" class="btn btn-outline">View All</a>
                                </div>
                                <div id="recentBookings">
                                    <!-- Recent bookings will be loaded here -->
                                </div>
                            </div>

                            <!-- Profile Section -->
                            <div class="profile-section">
                                <div class="section-header">
                                    <h2>👤 My Profile</h2>
                                    <button class="btn btn-outline" id="editProfileBtn" onclick="toggleProfileEdit()">
                                        Edit Profile
                                    </button>
                                </div>

                                <!-- Profile Display -->
                                <div id="profileDisplay" class="profile-display">
                                    <div class="profile-grid">
                                        <div class="profile-item">
                                            <label>Name:</label>
                                            <span id="displayName">-</span>
                                        </div>
                                        <div class="profile-item">
                                            <label>Email:</label>
                                            <span id="displayEmail">-</span>
                                        </div>
                                        <div class="profile-item">
                                            <label>Phone:</label>
                                            <span id="displayPhone">-</span>
                                        </div>
                                        <div class="profile-item">
                                            <label>Business Address:</label>
                                            <span id="displayAddress">-</span>
                                        </div>
                                        <div class="profile-item">
                                            <label>City:</label>
                                            <span id="displayCity">-</span>
                                        </div>
                                        <div class="profile-item">
                                            <label>State:</label>
                                            <span id="displayState">-</span>
                                        </div>
                                        <div class="profile-item">
                                            <label>ZIP:</label>
                                            <span id="displayZip">-</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Profile Edit Form -->
                                <div id="profileEdit" class="profile-edit" style="display: none;">
                                    <form id="profileForm">
                                        <div class="form-row">
                                            <div class="form-group">
                                                <label>First Name</label>
                                                <input type="text" id="firstName" required>
                                            </div>
                                            <div class="form-group">
                                                <label>Last Name</label>
                                                <input type="text" id="lastName" required>
                                            </div>
                                        </div>
                                        <div class="form-group">
                                            <label>Phone</label>
                                            <input type="tel" id="phone">
                                        </div>
                                        <div class="form-group">
                                            <label>Business Address</label>
                                            <input type="text" id="address">
                                        </div>
                                        <div class="form-row">
                                            <div class="form-group">
                                                <label>City</label>
                                                <input type="text" id="city">
                                            </div>
                                            <div class="form-group">
                                                <label>State</label>
                                                <input type="text" id="state" value="NC">
                                            </div>
                                            <div class="form-group">
                                                <label>ZIP</label>
                                                <input type="text" id="zip">
                                            </div>
                                        </div>
                                        <div class="form-buttons">
                                            <button type="button" class="btn btn-outline" onclick="cancelProfileEdit()">Cancel</button>
                                            <button type="submit" class="btn btn-primary">Save Profile</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>

                        <!-- Add Camp Modal -->
                        <div id="addCampModal" class="modal">
                            <div class="modal-content wide">
                                <span class="close" onclick="closeModal('addCampModal')">&times;</span>
                                <h2 id="campModalTitle">Add New Camp</h2>
                                <form id="campForm">
                                    <input type="hidden" id="campId" value="">

                                        <div class="form-row">
                                            <div class="form-group">
                                                <label>Camp Name</label>
                                                <input type="text" id="campName" required>
                                            </div>
                                            <div class="form-group">
                                                <label>Location</label>
                                                <input type="text" id="campLocation" required>
                                            </div>
                                        </div>

                                        <div class="form-group">
                                            <label>Description</label>
                                            <textarea id="campDescription" rows="3" placeholder="Describe your camp..."></textarea>
                                        </div>

                                        <div class="form-row">
                                            <div class="form-group">
                                                <label>Minimum Age</label>
                                                <input type="number" id="minAge" min="3" max="18" value="5">
                                            </div>
                                            <div class="form-group">
                                                <label>Maximum Age</label>
                                                <input type="number" id="maxAge" min="3" max="18" value="12">
                                            </div>
                                        </div>

                                        <div class="form-group">
                                            <label>Interests/Activities (Select all that apply)</label>
                                            <div class="checkbox-grid">
                                                <label><input type="checkbox" name="camp-interests" value="sports"> Sports</label>
                                                <label><input type="checkbox" name="camp-interests" value="arts"> Arts & Crafts</label>
                                                <label><input type="checkbox" name="camp-interests" value="stem"> STEM/Science</label>
                                                <label><input type="checkbox" name="camp-interests" value="nature"> Nature/Outdoors</label>
                                                <label><input type="checkbox" name="camp-interests" value="academic"> Academic</label>
                                                <label><input type="checkbox" name="camp-interests" value="music"> Music</label>
                                                <label><input type="checkbox" name="camp-interests" value="theater"> Theater/Drama</label>
                                                <label><input type="checkbox" name="camp-interests" value="cooking"> Cooking</label>
                                            </div>
                                        </div>

                                        <div class="form-group">
                                            <label>Accommodations Available</label>
                                            <div class="checkbox-grid">
                                                <label><input type="checkbox" name="camp-accommodations" value="wheelchair_accessible"> Wheelchair accessible</label>
                                                <label><input type="checkbox" name="camp-accommodations" value="nut_free_environment"> Nut-free environment</label>
                                                <label><input type="checkbox" name="camp-accommodations" value="adhd_support"> ADHD support</label>
                                                <label><input type="checkbox" name="camp-accommodations" value="autism_support"> Autism spectrum support</label>
                                                <label><input type="checkbox" name="camp-accommodations" value="medical_needs"> Medical needs support</label>
                                            </div>
                                        </div>

                                        <div class="form-buttons">
                                            <button type="button" class="btn btn-outline" onclick="closeModal('addCampModal')">Cancel</button>
                                            <button type="submit" class="btn btn-primary">Save Camp</button>
                                        </div>
                                </form>
                            </div>
                        </div>

                        <!-- Add Schedule Modal -->
                        <div id="addScheduleModal" class="modal">
                            <div class="modal-content">
                                <span class="close" onclick="closeModal('addScheduleModal')">&times;</span>
                                <h2>Add Camp Schedule</h2>
                                <form id="scheduleForm">
                                    <input type="hidden" id="scheduleCampId" value="">

                                        <div class="form-row">
                                            <div class="form-group">
                                                <label>Start Date</label>
                                                <input type="date" id="startDate" required>
                                            </div>
                                            <div class="form-group">
                                                <label>End Date</label>
                                                <input type="date" id="endDate" required>
                                            </div>
                                        </div>

                                        <div class="form-row">
                                            <div class="form-group">
                                                <label>Start Time</label>
                                                <input type="time" id="startTime" value="09:00">
                                            </div>
                                            <div class="form-group">
                                                <label>End Time</label>
                                                <input type="time" id="endTime" value="15:00">
                                            </div>
                                        </div>

                                        <div class="form-row">
                                            <div class="form-group">
                                                <label>Cost ($)</label>
                                                <input type="number" id="cost" min="0" step="0.01" placeholder="0.00">
                                            </div>
                                            <div class="form-group">
                                                <label>Available Spots</label>
                                                <input type="number" id="availableSpots" min="1" value="20">
                                            </div>
                                        </div>

                                        <div class="form-buttons">
                                            <button type="button" class="btn btn-outline" onclick="closeModal('addScheduleModal')">Cancel</button>
                                            <button type="submit" class="btn btn-primary">Add Schedule</button>
                                        </div>
                                </form>
                            </div>
                        </div>

                        <!-- Scripts -->
                        <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
                        <script src="js/config.js"></script>
                        <script src="js/navigation.js"></script>
                        <script src="js/camp-dashboard.js"></script>
                    </body>

                </html>