"""
CrewBook Form Validation Tests
Tests all form validations across Login, Register, Create Gig, GigBoard, Profile, and GigDetail pages.
"""
import asyncio

BASE_URL = "https://crewbook-preview.preview.emergentagent.com"
LEAD_EMAIL = "arjun.kapoor@crewbook.in"
LEAD_PASSWORD = "Crewbook@123"

async def test_login_form_validations(page):
    """Test Login form: empty fields and invalid email"""
    print("\n=== TEST: Login Form Validations ===")
    results = {}
    
    await page.goto(f"{BASE_URL}/auth")
    await page.wait_for_selector('[data-testid="login-email"]', timeout=10000)
    print("✓ Auth page loaded")
    
    # Test 1: Empty submit shows errors
    try:
        await page.click('[data-testid="login-submit-btn"]', force=True)
        await page.wait_for_timeout(500)
        
        # Check for email error
        email_errors = await page.query_selector_all('[data-testid="login-email"] + p.text-red-500, [data-testid="login-email"] ~ p.text-red-500')
        
        # Use evaluate to find FieldError components (p.text-xs.text-red-500)
        error_texts = await page.evaluate("""() => {
            const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
            return allP.map(p => p.textContent.trim());
        }""")
        
        print(f"  Errors on empty submit: {error_texts}")
        
        has_email_err = any("email" in t.lower() or "required" in t.lower() for t in error_texts)
        has_pass_err = any("password" in t.lower() or "required" in t.lower() for t in error_texts)
        
        if error_texts:
            print(f"  ✓ PASS: Empty submit shows errors: {error_texts}")
            results["empty_submit"] = "PASS"
        else:
            print(f"  ✗ FAIL: No errors shown on empty submit")
            results["empty_submit"] = "FAIL"
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        results["empty_submit"] = f"ERROR: {e}"
    
    # Test 2: Invalid email format
    try:
        await page.fill('[data-testid="login-email"]', 'notanemail')
        await page.click('[data-testid="login-submit-btn"]', force=True)
        await page.wait_for_timeout(500)
        
        error_texts = await page.evaluate("""() => {
            const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
            return allP.map(p => p.textContent.trim());
        }""")
        
        valid_email_err = any("valid email" in t.lower() for t in error_texts)
        print(f"  Invalid email errors: {error_texts}")
        
        if valid_email_err:
            print(f"  ✓ PASS: Invalid email shows 'Enter a valid email address'")
            results["invalid_email"] = "PASS"
        else:
            print(f"  ✗ FAIL: No 'valid email' error shown. Got: {error_texts}")
            results["invalid_email"] = "FAIL"
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        results["invalid_email"] = f"ERROR: {e}"
    
    # Test 3: Empty password
    try:
        await page.fill('[data-testid="login-email"]', 'test@example.com')
        await page.fill('[data-testid="login-password"]', '')
        # Blur password field
        await page.click('[data-testid="login-submit-btn"]', force=True)
        await page.wait_for_timeout(500)
        
        error_texts = await page.evaluate("""() => {
            const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
            return allP.map(p => p.textContent.trim());
        }""")
        
        has_pass_err = any("password" in t.lower() for t in error_texts)
        print(f"  Empty password errors: {error_texts}")
        
        if has_pass_err:
            print(f"  ✓ PASS: Empty password shows 'Password is required'")
            results["empty_password"] = "PASS"
        else:
            print(f"  ✗ FAIL: No password error shown. Got: {error_texts}")
            results["empty_password"] = "FAIL"
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        results["empty_password"] = f"ERROR: {e}"
    
    return results


async def test_register_form_validations(page):
    """Test Register form: full_name, phone, password validations"""
    print("\n=== TEST: Register Form Validations ===")
    results = {}
    
    await page.goto(f"{BASE_URL}/auth")
    await page.wait_for_selector('[data-testid="auth-register-tab"]', timeout=10000)
    await page.click('[data-testid="auth-register-tab"]', force=True)
    await page.wait_for_timeout(500)
    await page.wait_for_selector('[data-testid="reg-name"]', timeout=5000)
    print("✓ Register tab opened")
    
    # Test 1: Empty full_name blur
    try:
        await page.click('[data-testid="reg-name"]')
        await page.fill('[data-testid="reg-name"]', '')
        await page.press('[data-testid="reg-name"]', 'Tab')
        await page.wait_for_timeout(400)
        
        error_texts = await page.evaluate("""() => {
            const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
            return allP.map(p => p.textContent.trim());
        }""")
        
        has_name_err = any("full name" in t.lower() or "name is required" in t.lower() for t in error_texts)
        print(f"  Empty full_name blur errors: {error_texts}")
        
        if has_name_err:
            print(f"  ✓ PASS: Empty full_name shows 'Full name is required'")
            results["empty_full_name"] = "PASS"
        else:
            print(f"  ✗ FAIL: No name error. Got: {error_texts}")
            results["empty_full_name"] = "FAIL"
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        results["empty_full_name"] = f"ERROR: {e}"
    
    # Test 2: 9-digit phone (invalid)
    try:
        await page.fill('[data-testid="reg-phone"]', '987654321')  # 9 digits
        await page.press('[data-testid="reg-phone"]', 'Tab')
        await page.wait_for_timeout(400)
        
        error_texts = await page.evaluate("""() => {
            const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
            return allP.map(p => p.textContent.trim());
        }""")
        
        has_phone_err = any("10-digit" in t or "10 digit" in t.lower() or "mobile" in t.lower() for t in error_texts)
        print(f"  9-digit phone blur errors: {error_texts}")
        
        if has_phone_err:
            print(f"  ✓ PASS: 9-digit phone shows '10-digit mobile number' error")
            results["invalid_phone_9_digit"] = "PASS"
        else:
            print(f"  ✗ FAIL: No phone error. Got: {error_texts}")
            results["invalid_phone_9_digit"] = "FAIL"
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        results["invalid_phone_9_digit"] = f"ERROR: {e}"
    
    # Test 3: Password shorter than 8 chars
    try:
        await page.fill('[data-testid="reg-password"]', 'abc1')  # 4 chars
        await page.press('[data-testid="reg-password"]', 'Tab')
        await page.wait_for_timeout(400)
        
        error_texts = await page.evaluate("""() => {
            const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
            return allP.map(p => p.textContent.trim());
        }""")
        
        has_len_err = any("8 characters" in t or "at least 8" in t.lower() for t in error_texts)
        print(f"  Short password errors: {error_texts}")
        
        if has_len_err:
            print(f"  ✓ PASS: Short password shows 'at least 8 characters'")
            results["short_password"] = "PASS"
        else:
            print(f"  ✗ FAIL: No password length error. Got: {error_texts}")
            results["short_password"] = "FAIL"
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        results["short_password"] = f"ERROR: {e}"
    
    # Test 4: Password with no numbers
    try:
        await page.fill('[data-testid="reg-password"]', 'abcdefgh')  # 8 chars, no number
        await page.press('[data-testid="reg-password"]', 'Tab')
        await page.wait_for_timeout(400)
        
        error_texts = await page.evaluate("""() => {
            const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
            return allP.map(p => p.textContent.trim());
        }""")
        
        has_num_err = any("number" in t.lower() for t in error_texts)
        print(f"  No-number password errors: {error_texts}")
        
        if has_num_err:
            print(f"  ✓ PASS: No-number password shows 'at least one number'")
            results["password_no_number"] = "PASS"
        else:
            print(f"  ✗ FAIL: No 'number' error. Got: {error_texts}")
            results["password_no_number"] = "FAIL"
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        results["password_no_number"] = f"ERROR: {e}"
    
    return results


async def login_as_lead(page):
    """Helper: Log in as lead photographer"""
    await page.goto(f"{BASE_URL}/auth")
    await page.wait_for_selector('[data-testid="login-email"]', timeout=10000)
    await page.fill('[data-testid="login-email"]', LEAD_EMAIL)
    await page.fill('[data-testid="login-password"]', LEAD_PASSWORD)
    await page.click('[data-testid="login-submit-btn"]', force=True)
    # Wait for navigation
    try:
        await page.wait_for_url('**/dashboard**', timeout=10000)
        print(f"✓ Logged in as {LEAD_EMAIL}")
        return True
    except Exception:
        # Try waiting for any page change
        await page.wait_for_timeout(3000)
        current_url = page.url
        if '/auth' not in current_url:
            print(f"✓ Logged in, at: {current_url}")
            return True
        print(f"✗ Login may have failed, still at: {current_url}")
        return False


async def test_create_gig_dialog_validations(page):
    """Test Create Gig dialog validations"""
    print("\n=== TEST: Create Gig Dialog Validations ===")
    results = {}
    
    logged_in = await login_as_lead(page)
    if not logged_in:
        print("  ✗ Could not login, skipping Gig tests")
        return {"login": "FAIL"}
    
    # Navigate to Gigs page
    await page.goto(f"{BASE_URL}/gigs")
    await page.wait_for_selector('[data-testid="create-gig-btn"]', timeout=10000)
    print("✓ Gigs page loaded")
    
    # Open create gig dialog
    await page.click('[data-testid="create-gig-btn"]', force=True)
    await page.wait_for_selector('[data-testid="gig-title-input"]', timeout=5000)
    print("✓ Create Gig dialog opened")
    
    # Test 1: Empty title on submit
    try:
        await page.fill('[data-testid="gig-title-input"]', '')
        await page.click('[data-testid="submit-create-gig-btn"]', force=True)
        await page.wait_for_timeout(500)
        
        error_texts = await page.evaluate("""() => {
            const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
            return allP.map(p => p.textContent.trim());
        }""")
        
        has_title_err = any("gig title" in t.lower() or "title is required" in t.lower() or "required" in t.lower() for t in error_texts)
        print(f"  Empty gig title errors: {error_texts}")
        
        if has_title_err:
            print(f"  ✓ PASS: Empty title shows 'Gig title is required'")
            results["empty_gig_title"] = "PASS"
        else:
            print(f"  ✗ FAIL: No title error. Got: {error_texts}")
            results["empty_gig_title"] = "FAIL"
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        results["empty_gig_title"] = f"ERROR: {e}"
    
    # Test 2: Past session date
    try:
        # Set a valid title first
        await page.fill('[data-testid="gig-title-input"]', 'Test Gig Validation')
        
        # Set past date on the session date field
        await page.fill('input[type="date"]', '2020-01-01')
        await page.press('input[type="date"]', 'Tab')
        await page.wait_for_timeout(600)
        
        error_texts = await page.evaluate("""() => {
            const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
            return allP.map(p => p.textContent.trim());
        }""")
        
        has_past_err = any("past" in t.lower() or "future" in t.lower() for t in error_texts)
        print(f"  Past date errors: {error_texts}")
        
        if has_past_err:
            print(f"  ✓ PASS: Past date shows 'cannot be in the past'")
            results["past_session_date"] = "PASS"
        else:
            print(f"  ✗ FAIL: No past date error. Got: {error_texts}")
            results["past_session_date"] = "FAIL"
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        results["past_session_date"] = f"ERROR: {e}"
    
    # Test 3: End time before start time
    try:
        # Set start time > end time
        time_inputs = await page.query_selector_all('input[type="time"]')
        print(f"  Found {len(time_inputs)} time inputs")
        
        if len(time_inputs) >= 2:
            await time_inputs[0].fill('18:00')  # start time
            await time_inputs[1].fill('09:00')  # end time before start
            await time_inputs[1].dispatch_event('blur')
            await page.wait_for_timeout(500)
            
            error_texts = await page.evaluate("""() => {
                const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
                return allP.map(p => p.textContent.trim());
            }""")
            
            has_time_err = any("end time" in t.lower() or "after start" in t.lower() for t in error_texts)
            print(f"  Time range errors: {error_texts}")
            
            if has_time_err:
                print(f"  ✓ PASS: End time before start shows 'End time must be after start time'")
                results["end_before_start"] = "PASS"
            else:
                print(f"  ✗ FAIL: No time range error. Got: {error_texts}")
                results["end_before_start"] = "FAIL"
        else:
            print(f"  ✗ SKIP: Not enough time inputs found")
            results["end_before_start"] = "SKIP: no time inputs"
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        results["end_before_start"] = f"ERROR: {e}"
    
    # Test 4: Empty location
    try:
        # Find location input in session block (not the title) and blur it empty
        location_inputs = await page.query_selector_all('input[placeholder="City / Area"]')
        print(f"  Found {len(location_inputs)} location inputs")
        
        if location_inputs:
            await location_inputs[0].fill('')
            await location_inputs[0].dispatch_event('blur')
            await page.wait_for_timeout(500)
            
            error_texts = await page.evaluate("""() => {
                const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
                return allP.map(p => p.textContent.trim());
            }""")
            
            has_loc_err = any("location" in t.lower() for t in error_texts)
            print(f"  Empty location errors: {error_texts}")
            
            if has_loc_err:
                print(f"  ✓ PASS: Empty location shows 'Location is required'")
                results["empty_location"] = "PASS"
            else:
                print(f"  ✗ FAIL: No location error. Got: {error_texts}")
                results["empty_location"] = "FAIL"
        else:
            # Try submit instead
            await page.click('[data-testid="submit-create-gig-btn"]', force=True)
            await page.wait_for_timeout(500)
            error_texts = await page.evaluate("""() => {
                const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
                return allP.map(p => p.textContent.trim());
            }""")
            has_loc_err = any("location" in t.lower() for t in error_texts)
            print(f"  Empty location (via submit) errors: {error_texts}")
            if has_loc_err:
                results["empty_location"] = "PASS"
                print(f"  ✓ PASS: Empty location shows 'Location is required'")
            else:
                results["empty_location"] = "FAIL"
                print(f"  ✗ FAIL: No location error. Got: {error_texts}")
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        results["empty_location"] = f"ERROR: {e}"
    
    return results


async def test_post_public_gig_validations(page):
    """Test GigBoard Post Public Gig validations"""
    print("\n=== TEST: GigBoard Post Public Gig Validations ===")
    results = {}
    
    # Navigate to GigBoard
    await page.goto(f"{BASE_URL}/gig-board")
    await page.wait_for_timeout(2000)
    print(f"  Current URL: {page.url}")
    
    # Check if there's access/upgrade wall  
    upgrade_wall = await page.query_selector('[data-testid="gig-board-upgrade-wall"]')
    if upgrade_wall:
        print("  ℹ User has upgrade wall - using premium account or checking if plan needed")
    
    # Click Post Gig button
    post_btn = await page.query_selector('[data-testid="post-gig-btn"]')
    if not post_btn:
        print("  ✗ Post Gig button not found - may need to check access")
        results["post_gig_modal"] = "SKIP: No access"
        return results
    
    await post_btn.click(force=True)
    await page.wait_for_timeout(1000)
    
    # Check if modal opened
    modal_title = await page.query_selector('text=Post a Public Gig')
    if not modal_title:
        print("  ✗ Post Gig modal did not open")
        results["post_gig_modal"] = "FAIL: Modal did not open"
        return results
    
    print("✓ Post Gig modal opened")
    
    # Test 1: Empty title - click Next
    try:
        # Click Next without filling title
        next_btn = await page.query_selector('[data-testid="post-gig-next"]')
        if next_btn:
            await next_btn.click(force=True)
            await page.wait_for_timeout(500)
            
            # Look for inline error (not FieldError component, but raw p tags)
            error_texts = await page.evaluate("""() => {
                const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
                return allP.map(p => p.textContent.trim());
            }""")
            
            has_title_err = any("gig title" in t.lower() or "title" in t.lower() for t in error_texts)
            print(f"  Empty title errors on Next: {error_texts}")
            
            if has_title_err:
                print(f"  ✓ PASS: Empty title shows 'Gig title is required' on Next click")
                results["post_gig_empty_title"] = "PASS"
            else:
                print(f"  ✗ FAIL: No title error. Got: {error_texts}")
                results["post_gig_empty_title"] = "FAIL"
        else:
            print("  ✗ Next button not found")
            results["post_gig_empty_title"] = "FAIL: Next button not found"
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        results["post_gig_empty_title"] = f"ERROR: {e}"
    
    # Test 2: Past date
    try:
        # Fill title first
        title_input = await page.query_selector('[data-testid="post-gig-title"]')
        if title_input:
            await title_input.fill('Test Weekend Wedding')
        
        # Set past date
        date_input = await page.query_selector('[data-testid="post-gig-date"]')
        if date_input:
            await date_input.fill('2020-06-15')
            await date_input.dispatch_event('blur')
            await page.wait_for_timeout(400)
            
            error_texts = await page.evaluate("""() => {
                const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
                return allP.map(p => p.textContent.trim());
            }""")
            
            has_date_err = any("past" in t.lower() for t in error_texts)
            print(f"  Past date errors in GigBoard: {error_texts}")
            
            if has_date_err:
                print(f"  ✓ PASS: Past date shows 'Date cannot be in the past'")
                results["post_gig_past_date"] = "PASS"
            else:
                # Try clicking Next to trigger validation
                next_btn = await page.query_selector('[data-testid="post-gig-next"]')
                if next_btn:
                    await next_btn.click(force=True)
                    await page.wait_for_timeout(400)
                    error_texts = await page.evaluate("""() => {
                        const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
                        return allP.map(p => p.textContent.trim());
                    }""")
                    has_date_err = any("past" in t.lower() for t in error_texts)
                    print(f"  Past date (via Next) errors: {error_texts}")
                    if has_date_err:
                        print(f"  ✓ PASS: Past date shows error via Next click")
                        results["post_gig_past_date"] = "PASS"
                    else:
                        print(f"  ✗ FAIL: No past date error. Got: {error_texts}")
                        results["post_gig_past_date"] = "FAIL"
                else:
                    results["post_gig_past_date"] = "FAIL"
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        results["post_gig_past_date"] = f"ERROR: {e}"
    
    return results


async def test_profile_edit_validations(page):
    """Test Profile edit validations for URL, UPI, day rate"""
    print("\n=== TEST: Profile Edit Validations ===")
    results = {}
    
    # Navigate to own profile
    await page.goto(f"{BASE_URL}/dashboard")
    await page.wait_for_timeout(2000)
    
    # Find profile link
    await page.goto(f"{BASE_URL}/profile/{LEAD_EMAIL.split('@')[0].replace('.', '-')}")
    await page.wait_for_timeout(2000)
    
    # Better: navigate using sidebar
    current_url = page.url
    print(f"  Current URL: {current_url}")
    
    # Try to find own profile by going to /profile/me or via user ID from API
    # Let's navigate to auth to get the user ID and then to profile
    # Actually let's use the Edit Profile button from the dashboard area
    
    # Navigate through the app to find profile
    await page.goto(f"{BASE_URL}/dashboard")
    await page.wait_for_timeout(2000)
    
    # Look for a profile link
    profile_link = await page.query_selector('a[href*="/profile/"]')
    if profile_link:
        await profile_link.click()
        await page.wait_for_timeout(2000)
    else:
        # Try the sidebar
        sidebar_links = await page.query_selector_all('a[href*="profile"]')
        if sidebar_links:
            await sidebar_links[0].click()
            await page.wait_for_timeout(2000)
    
    print(f"  Current URL: {page.url}")
    
    # Click Edit Profile button
    edit_btn = await page.query_selector('[data-testid="edit-profile-btn"]')
    if not edit_btn:
        print("  ✗ Edit Profile button not found, trying direct navigation")
        # Get user ID from page if possible
        results["profile_access"] = "FAIL: No edit button"
        return results
    
    await edit_btn.click(force=True)
    await page.wait_for_timeout(1000)
    
    edit_dialog = await page.query_selector('[data-testid="edit-instagram"]')
    if not edit_dialog:
        print("  ✗ Edit dialog not opened")
        results["profile_dialog"] = "FAIL"
        return results
    
    print("✓ Edit Profile dialog opened")
    
    # Test 1: Invalid Instagram URL
    try:
        await page.fill('[data-testid="edit-instagram"]', 'notaurl')
        await page.dispatch_event('[data-testid="edit-instagram"]', 'blur')
        await page.wait_for_timeout(400)
        
        error_texts = await page.evaluate("""() => {
            const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
            return allP.map(p => p.textContent.trim());
        }""")
        
        has_url_err = any("valid url" in t.lower() or "url" in t.lower() for t in error_texts)
        print(f"  Invalid URL errors: {error_texts}")
        
        if has_url_err:
            print(f"  ✓ PASS: Invalid URL shows 'Enter a valid URL'")
            results["invalid_instagram_url"] = "PASS"
        else:
            print(f"  ✗ FAIL: No URL error. Got: {error_texts}")
            results["invalid_instagram_url"] = "FAIL"
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        results["invalid_instagram_url"] = f"ERROR: {e}"
    
    # Test 2: Invalid UPI ID
    try:
        await page.fill('[data-testid="edit-upi"]', 'invalidupi!!!')
        await page.dispatch_event('[data-testid="edit-upi"]', 'blur')
        await page.wait_for_timeout(400)
        
        error_texts = await page.evaluate("""() => {
            const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
            return allP.map(p => p.textContent.trim());
        }""")
        
        has_upi_err = any("upi" in t.lower() for t in error_texts)
        print(f"  Invalid UPI errors: {error_texts}")
        
        if has_upi_err:
            print(f"  ✓ PASS: Invalid UPI shows error")
            results["invalid_upi"] = "PASS"
        else:
            print(f"  ✗ FAIL: No UPI error. Got: {error_texts}")
            results["invalid_upi"] = "FAIL"
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        results["invalid_upi"] = f"ERROR: {e}"
    
    # Test 3: Negative day rate
    try:
        await page.fill('[data-testid="edit-primary-rate"]', '-500')
        await page.dispatch_event('[data-testid="edit-primary-rate"]', 'blur')
        await page.wait_for_timeout(400)
        
        error_texts = await page.evaluate("""() => {
            const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
            return allP.map(p => p.textContent.trim());
        }""")
        
        has_rate_err = any("positive" in t.lower() or "rate" in t.lower() for t in error_texts)
        print(f"  Negative rate errors: {error_texts}")
        
        if has_rate_err:
            print(f"  ✓ PASS: Negative rate shows error")
            results["negative_day_rate"] = "PASS"
        else:
            # Also try saving and checking errors
            await page.click('[data-testid="save-profile-btn"]', force=True)
            await page.wait_for_timeout(500)
            error_texts = await page.evaluate("""() => {
                const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
                return allP.map(p => p.textContent.trim());
            }""")
            has_rate_err = any("positive" in t.lower() or "rate" in t.lower() for t in error_texts)
            print(f"  Negative rate (via save) errors: {error_texts}")
            if has_rate_err:
                print(f"  ✓ PASS: Negative rate shows error via save")
                results["negative_day_rate"] = "PASS"
            else:
                print(f"  ✗ FAIL: No rate error. Got: {error_texts}")
                results["negative_day_rate"] = "FAIL"
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        results["negative_day_rate"] = f"ERROR: {e}"
    
    return results


async def test_gig_invite_form_validations(page):
    """Test GigDetail invite form validations"""
    print("\n=== TEST: GigDetail Invite Form Validations ===")
    results = {}
    
    # Navigate to Gigs list
    await page.goto(f"{BASE_URL}/gigs")
    await page.wait_for_timeout(2000)
    
    # Click on the first gig to open GigDetail
    gig_items = await page.query_selector_all('[data-testid^="gig-item-"]')
    print(f"  Found {len(gig_items)} gig items")
    
    if not gig_items:
        print("  ✗ No gigs found, cannot test invite form")
        results["no_gigs"] = "SKIP: No gigs found"
        return results
    
    # Click first gig
    await gig_items[0].click()
    await page.wait_for_timeout(2000)
    print(f"  Current URL: {page.url}")
    
    # Navigate to Team tab and open Invite dialog
    invite_btn = await page.query_selector('[data-testid="invite-crew-btn"]')
    if not invite_btn:
        # Try clicking Team tab first
        team_tabs = await page.query_selector_all('text=Team')
        if team_tabs:
            await team_tabs[0].click()
            await page.wait_for_timeout(1000)
        invite_btn = await page.query_selector('[data-testid="invite-crew-btn"]')
    
    if not invite_btn:
        print("  ✗ Invite Crew button not found (may not be lead or no gigs)")
        results["invite_btn"] = "SKIP: No invite button"
        return results
    
    await invite_btn.click(force=True)
    await page.wait_for_timeout(1000)
    
    # Check if invite dialog opened
    invite_freelancer = await page.query_selector('[data-testid="invite-freelancer-select"]')
    if not invite_freelancer:
        print("  ✗ Invite dialog not opened")
        results["invite_dialog"] = "FAIL"
        return results
    
    print("✓ Invite dialog opened")
    
    # Test 1: Submit without selecting freelancer
    try:
        # Make sure freelancer is not selected
        await page.select_option('[data-testid="invite-freelancer-select"]', value='', force=True)
        await page.wait_for_timeout(200)
        
        await page.click('[data-testid="send-invite-btn"]', force=True)
        await page.wait_for_timeout(500)
        
        error_texts = await page.evaluate("""() => {
            const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
            return allP.map(p => p.textContent.trim());
        }""")
        
        has_freelancer_err = any("freelancer" in t.lower() or "select" in t.lower() for t in error_texts)
        print(f"  No freelancer errors: {error_texts}")
        
        if has_freelancer_err:
            print(f"  ✓ PASS: No freelancer shows 'Please select a freelancer'")
            results["no_freelancer"] = "PASS"
        else:
            print(f"  ✗ FAIL: No freelancer error. Got: {error_texts}")
            results["no_freelancer"] = "FAIL"
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        results["no_freelancer"] = f"ERROR: {e}"
    
    # Test 2: Fee of 0 shows 'must be a positive number'
    try:
        await page.fill('[data-testid="invite-fee-input"]', '0')
        await page.dispatch_event('[data-testid="invite-fee-input"]', 'blur')
        await page.wait_for_timeout(400)
        
        error_texts = await page.evaluate("""() => {
            const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
            return allP.map(p => p.textContent.trim());
        }""")
        
        has_fee_err = any("positive" in t.lower() or "fee" in t.lower() for t in error_texts)
        print(f"  Fee=0 errors: {error_texts}")
        
        if has_fee_err:
            print(f"  ✓ PASS: Fee=0 shows 'must be a positive number'")
            results["fee_zero"] = "PASS"
        else:
            # Try submitting
            await page.click('[data-testid="send-invite-btn"]', force=True)
            await page.wait_for_timeout(400)
            error_texts = await page.evaluate("""() => {
                const allP = Array.from(document.querySelectorAll('p.text-xs.text-red-500'));
                return allP.map(p => p.textContent.trim());
            }""")
            has_fee_err = any("positive" in t.lower() or "fee" in t.lower() for t in error_texts)
            print(f"  Fee=0 (via submit) errors: {error_texts}")
            if has_fee_err:
                print(f"  ✓ PASS: Fee=0 shows 'must be a positive number' via submit")
                results["fee_zero"] = "PASS"
            else:
                print(f"  ✗ FAIL: No fee error. Got: {error_texts}")
                results["fee_zero"] = "FAIL"
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        results["fee_zero"] = f"ERROR: {e}"
    
    return results


async def run_all_tests(page):
    """Run all validation tests and collect results"""
    await page.set_viewport_size({"width": 1920, "height": 1080})
    page.on("console", lambda msg: print(f"BROWSER: {msg.text}") if msg.type == "error" else None)
    
    all_results = {}
    
    # Take screenshot of initial app state
    await page.goto(f"{BASE_URL}/auth")
    await page.wait_for_timeout(2000)
    await page.screenshot(path=".screenshots/01_auth_page.png", quality=40, full_page=False)
    print("✓ Screenshot taken: Auth page")
    
    # Test 1: Login form validations
    login_results = await test_login_form_validations(page)
    all_results["login_form"] = login_results
    
    # Test 2: Register form validations
    reg_results = await test_register_form_validations(page)
    all_results["register_form"] = reg_results
    
    # Take screenshot of register form after validations
    await page.screenshot(path=".screenshots/02_register_validations.png", quality=40, full_page=False)
    
    # Test 3: Create Gig dialog validations (requires login)
    gig_results = await test_create_gig_dialog_validations(page)
    all_results["create_gig"] = gig_results
    
    # Take screenshot of create gig dialog
    await page.screenshot(path=".screenshots/03_create_gig_validations.png", quality=40, full_page=False)
    
    # Test 4: Post Public Gig validations
    gigboard_results = await test_post_public_gig_validations(page)
    all_results["post_public_gig"] = gigboard_results
    
    await page.screenshot(path=".screenshots/04_gigboard_validations.png", quality=40, full_page=False)
    
    # Test 5: Profile edit validations
    profile_results = await test_profile_edit_validations(page)
    all_results["profile_edit"] = profile_results
    
    await page.screenshot(path=".screenshots/05_profile_validations.png", quality=40, full_page=False)
    
    # Test 6: GigDetail invite form validations
    invite_results = await test_gig_invite_form_validations(page)
    all_results["invite_form"] = invite_results
    
    # Final summary
    print("\n" + "=" * 60)
    print("VALIDATION TEST SUMMARY")
    print("=" * 60)
    
    total = 0
    passed = 0
    failed = 0
    skipped = 0
    
    for section, tests in all_results.items():
        print(f"\n{section}:")
        for test_name, result in tests.items():
            total += 1
            if "PASS" in str(result):
                passed += 1
                print(f"  ✓ {test_name}: {result}")
            elif "SKIP" in str(result):
                skipped += 1
                print(f"  ⚠ {test_name}: {result}")
            else:
                failed += 1
                print(f"  ✗ {test_name}: {result}")
    
    print(f"\nTotal: {total} | Passed: {passed} | Failed: {failed} | Skipped: {skipped}")
    print(f"Success Rate: {round(passed/total*100) if total > 0 else 0}%")
    
    return all_results


# Execute
results = await run_all_tests(page)
