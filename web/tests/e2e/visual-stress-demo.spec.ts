import { test, expect, type Page } from '@playwright/test';

/**
 * Visual Stress Demo
 * 
 * This test creates 15-30 concurrent users all interacting with the canvas simultaneously.
 * Perfect for live demo during presentations - shows real-time sync under load.
 * 
 * SETUP: Run once to create test users (see signupUser function)
 * RUN: npx playwright test visual-stress-demo.spec.ts --headed
 * Disable auth.setup.ts for diverse users
 * 
 * For 30 users: Change NUM_USERS to 30 and uncomment the super stress test
 */

const CANVAS_URL = '/c/main';
const NUM_USERS = 5; // 5 users for local dev, increase for production demos
const DEMO_DURATION_MS = 45000; // 45 seconds
const TEST_PASSWORD = 'Test1234'; // 8 characters, all users use this
const SIGNUP_USERS = false; // Set to true ONCE to create users, then false

// User data with first/last names
const TEST_USERS = [
	{ username: 'testuser1', firstName: 'Alice', lastName: 'Anderson' },
	{ username: 'testuser2', firstName: 'Bob', lastName: 'Baker' },
	{ username: 'testuser3', firstName: 'Carol', lastName: 'Chen' },
	{ username: 'testuser4', firstName: 'David', lastName: 'Davis' },
	{ username: 'testuser5', firstName: 'Emma', lastName: 'Evans' },
	{ username: 'testuser6', firstName: 'Frank', lastName: 'Fisher' },
	{ username: 'testuser7', firstName: 'Grace', lastName: 'Garcia' },
	{ username: 'testuser8', firstName: 'Henry', lastName: 'Hill' },
	{ username: 'testuser9', firstName: 'Iris', lastName: 'Ito' },
	{ username: 'testuser10', firstName: 'Jack', lastName: 'Jones' },
	{ username: 'testuser11', firstName: 'Kate', lastName: 'Kim' },
	{ username: 'testuser12', firstName: 'Leo', lastName: 'Lee' },
	{ username: 'testuser13', firstName: 'Maya', lastName: 'Miller' },
	{ username: 'testuser14', firstName: 'Noah', lastName: 'Nelson' },
	{ username: 'testuser15', firstName: 'Olivia', lastName: 'Olson' },
	{ username: 'testuser16', firstName: 'Peter', lastName: 'Parker' },
	{ username: 'testuser17', firstName: 'Quinn', lastName: 'Quinn' },
	{ username: 'testuser18', firstName: 'Ruby', lastName: 'Rose' },
	{ username: 'testuser19', firstName: 'Sam', lastName: 'Smith' },
	{ username: 'testuser20', firstName: 'Tara', lastName: 'Taylor' },
	{ username: 'testuser21', firstName: 'Uma', lastName: 'Upton' },
	{ username: 'testuser22', firstName: 'Victor', lastName: 'Vance' },
	{ username: 'testuser23', firstName: 'Wendy', lastName: 'Wang' },
	{ username: 'testuser24', firstName: 'Xavier', lastName: 'Xu' },
	{ username: 'testuser25', firstName: 'Yara', lastName: 'Young' },
	{ username: 'testuser26', firstName: 'Zoe', lastName: 'Zhang' },
	{ username: 'testuser27', firstName: 'Alex', lastName: 'Allen' },
	{ username: 'testuser28', firstName: 'Blake', lastName: 'Brown' },
	{ username: 'testuser29', firstName: 'Casey', lastName: 'Clark' },
	{ username: 'testuser30', firstName: 'Drew', lastName: 'Dixon' },
];

/**
 * Sign up a new test user (run ONCE)
 */
async function signupUser(
	page: Page,
	username: string,
	firstName: string,
	lastName: string,
	password: string
): Promise<void> {
	await page.goto(CANVAS_URL, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(2000);

	// Check if already signed in (from global auth state)
	const isSignedIn = await page.locator('button:has-text("Sign out")').isVisible().catch(() => false);
	
	if (isSignedIn) {
		// Sign out first
		const userButton = page.locator('.cl-userButtonTrigger, .cl-avatarBox').first();
		await userButton.click();
		await page.waitForTimeout(500);
		const signOutButton = page.locator('button:has-text("Sign out")');
		await signOutButton.click();
		await page.waitForTimeout(2000);
	}

	// Click "Sign In" button - use text selector for reliability
	const signInButton = page.locator('button:has-text("Sign in")').first();
	await signInButton.waitFor({ state: 'visible', timeout: 10000 });
	await signInButton.click();

	// Wait for Clerk modal, then click "Sign up" link
	await page.waitForTimeout(1500);
	const signUpLink = page.locator('a:has-text("Sign up")');
	await signUpLink.waitFor({ state: 'visible', timeout: 5000 });
	await signUpLink.click();

	// Fill sign up form
	await page.waitForTimeout(1500);
	
	// First name (optional)
	const firstNameInput = page.locator('input[name="firstName"]');
	await firstNameInput.waitFor({ state: 'visible', timeout: 10000 });
	await firstNameInput.fill(firstName);

	// Last name (optional)
	const lastNameInput = page.locator('input[name="lastName"]');
	await lastNameInput.waitFor({ state: 'visible', timeout: 5000 });
	await lastNameInput.fill(lastName);

	// Username (required)
	const usernameInput = page.locator('input[name="username"]');
	await usernameInput.waitFor({ state: 'visible', timeout: 5000 });
	await usernameInput.fill(username);

	// Password (required)
	const passwordInput = page.locator('input[name="password"]');
	await passwordInput.waitFor({ state: 'visible', timeout: 5000 });
	await passwordInput.fill(password);

	// Submit
	const continueButton = page.locator('button.cl-formButtonPrimary');
	await continueButton.waitFor({ state: 'visible', timeout: 5000 });
	await continueButton.click();

	// Wait for auth to complete
	await page.waitForSelector('button:has-text("Rectangle"):not([disabled])', {
		timeout: 15000,
	});
	
	await page.waitForTimeout(2000);
}

/**
 * Sign in existing test user (or skip if already signed in from global auth)
 */
async function signinUser(
	page: Page,
	username: string,
	password: string
): Promise<void> {
	await page.goto(CANVAS_URL, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(2000);

	// Check if already signed in (from global auth state)
	const isAlreadySignedIn = false;
	const hasRectangleButton = await page.locator('button:has-text("Rectangle"):not([disabled])').isVisible().catch(() => false);
	
	if (isAlreadySignedIn && hasRectangleButton) {
		// Already authenticated and on canvas, just proceed
		console.log(`User already signed in, proceeding to canvas actions`);
		await page.waitForTimeout(1000);
		return;
	}

	// Need to sign in
	const signInButton = page.locator('button:has-text("Sign in")').first();
	const signInVisible = await signInButton.isVisible().catch(() => false);
	
	if (!signInVisible) {
		// Might be signed in but not on canvas yet, wait for canvas
		await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
		await page.waitForSelector('button:has-text("Rectangle"):not([disabled])', {
			timeout: 10000,
		}).catch(() => {});
		return;
	}

	await signInButton.click();
	await page.waitForTimeout(1500);

	// Fill in username as identifier
	const identifierInput = page.locator('input[name="identifier"]').or(page.locator('input[name="username"]')).or(page.locator('input[name="emailAddress"]'));
	await identifierInput.first().waitFor({ state: 'visible', timeout: 10000 });
	await identifierInput.first().fill(username);

	// Continue button
	const continueButton = page.locator('button.cl-formButtonPrimary').first();
	await continueButton.click();

	await page.waitForTimeout(1500);

	// Password
	const passwordInput = page.locator('input[name="password"]');
	await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
	await passwordInput.fill(password);

	// Submit
	await page.locator('button.cl-formButtonPrimary').first().click();

	// Wait for canvas to be ready
	await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
	await page.waitForSelector('button:has-text("Rectangle"):not([disabled])', {
		timeout: 15000,
	});

	await page.waitForTimeout(2000);
}

/**
 * Perform random actions on canvas for specified duration
 */
async function performRandomActions(page: Page, duration: number): Promise<void> {
	const startTime = Date.now();
	
	const actions = [
		// Create rectangle (varied sizes) - SLOWER
		async () => {
			const rectButton = page.getByRole('button', { name: /rectangle/i });
			await rectButton.click();
			await page.waitForTimeout(200 + Math.random() * 300);
			
			const canvas = page.locator('canvas').first();
			const box = await canvas.boundingBox();
			if (box) {
				const x = box.x + 50 + Math.random() * (box.width - 200);
				const y = box.y + 50 + Math.random() * (box.height - 200);
				const width = 60 + Math.random() * 140;
				const height = 50 + Math.random() * 100;
				
				// Move to start position slowly
				await page.mouse.move(x, y, { steps: 15 });
				await page.waitForTimeout(100 + Math.random() * 200);
				await page.mouse.down();
				await page.waitForTimeout(100);
				// Drag slowly to create shape
				await page.mouse.move(x + width, y + height, { steps: 20 + Math.floor(Math.random() * 20) });
				await page.waitForTimeout(50);
				await page.mouse.up();
			}
		},
		
		// Create circle (varied sizes) - SLOWER
		async () => {
			const circleButton = page.getByRole('button', { name: /circle/i });
			await circleButton.click();
			await page.waitForTimeout(200 + Math.random() * 300);
			
			const canvas = page.locator('canvas').first();
			const box = await canvas.boundingBox();
			if (box) {
				const x = box.x + 50 + Math.random() * (box.width - 200);
				const y = box.y + 50 + Math.random() * (box.height - 200);
				const size = 50 + Math.random() * 100;
				
				await page.mouse.move(x, y, { steps: 15 });
				await page.waitForTimeout(100 + Math.random() * 200);
				await page.mouse.down();
				await page.waitForTimeout(100);
				await page.mouse.move(x + size, y + size, { steps: 20 + Math.floor(Math.random() * 20) });
				await page.waitForTimeout(50);
				await page.mouse.up();
			}
		},
		
		// Create text - SLOWER
		async () => {
			const textButton = page.getByRole('button', { name: /text/i });
			await textButton.click();
			await page.waitForTimeout(300 + Math.random() * 400);
			
			const canvas = page.locator('canvas').first();
			const box = await canvas.boundingBox();
			if (box) {
				const x = box.x + 50 + Math.random() * (box.width - 200);
				const y = box.y + 50 + Math.random() * (box.height - 200);
				
				// Move to position slowly before clicking
				await page.mouse.move(x, y, { steps: 15 });
				await page.waitForTimeout(200);
				await page.mouse.click(x, y);
				await page.waitForTimeout(500);
				
				const textInput = page.locator('input[placeholder*="Enter text"]');
				const isVisible = await textInput.isVisible().catch(() => false);
				if (isVisible) {
					const texts = ['Hello', 'Demo', 'Test', 'Canvas', 'Cool!', 'Nice', 'Wow', 'Amazing'];
					const text = texts[Math.floor(Math.random() * texts.length)];
					// Type slowly
					for (const char of text) {
						await page.keyboard.type(char);
						await page.waitForTimeout(50 + Math.random() * 100);
					}
					await page.waitForTimeout(200);
					await page.keyboard.press('Enter');
				}
			}
		},
		
		// Move cursor around (creates presence updates) - MORE DRAMATIC
		async () => {
			const canvas = page.locator('canvas').first();
			const box = await canvas.boundingBox();
			if (box) {
				const moves = 5 + Math.floor(Math.random() * 8); // More moves
				for (let i = 0; i < moves; i++) {
					// Random position across entire canvas
					const x = box.x + Math.random() * box.width;
					const y = box.y + Math.random() * box.height;
					// Much slower movement (more steps = slower)
					const steps = 20 + Math.floor(Math.random() * 30);
					await page.mouse.move(x, y, { steps });
					// Longer, more varied pauses
					await page.waitForTimeout(200 + Math.random() * 800);
				}
			}
		},
		
		// Sweep cursor across canvas (big dramatic movement)
		async () => {
			const canvas = page.locator('canvas').first();
			const box = await canvas.boundingBox();
			if (box) {
				// Start from one edge
				const startX = box.x + (Math.random() < 0.5 ? 0 : box.width);
				const startY = box.y + Math.random() * box.height;
				await page.mouse.move(startX, startY, { steps: 15 });
				await page.waitForTimeout(300);
				
				// Sweep to opposite edge
				const endX = box.x + (startX === box.x ? box.width : 0);
				const endY = box.y + Math.random() * box.height;
				await page.mouse.move(endX, endY, { steps: 50 }); // Very slow sweep
				await page.waitForTimeout(500);
			}
		},
		
		// Circle motion with cursor
		async () => {
			const canvas = page.locator('canvas').first();
			const box = await canvas.boundingBox();
			if (box) {
				const centerX = box.x + box.width / 2 + (Math.random() - 0.5) * 200;
				const centerY = box.y + box.height / 2 + (Math.random() - 0.5) * 200;
				const radius = 100 + Math.random() * 150;
				const points = 12 + Math.floor(Math.random() * 12);
				
				for (let i = 0; i < points; i++) {
					const angle = (i / points) * Math.PI * 2;
					const x = centerX + Math.cos(angle) * radius;
					const y = centerY + Math.sin(angle) * radius;
					await page.mouse.move(x, y, { steps: 15 });
					await page.waitForTimeout(100 + Math.random() * 300);
				}
			}
		},
		
		// Zigzag cursor movement
		async () => {
			const canvas = page.locator('canvas').first();
			const box = await canvas.boundingBox();
			if (box) {
				let x = box.x + Math.random() * box.width;
				let y = box.y + Math.random() * box.height;
				await page.mouse.move(x, y, { steps: 10 });
				
				const zigs = 4 + Math.floor(Math.random() * 6);
				for (let i = 0; i < zigs; i++) {
					const direction = i % 2 === 0 ? 1 : -1;
					x += direction * (100 + Math.random() * 150);
					y += (Math.random() - 0.5) * 100;
					
					// Keep within bounds
					x = Math.max(box.x, Math.min(box.x + box.width, x));
					y = Math.max(box.y, Math.min(box.y + box.height, y));
					
					await page.mouse.move(x, y, { steps: 20 + Math.floor(Math.random() * 20) });
					await page.waitForTimeout(300 + Math.random() * 500);
				}
			}
		},
		
		// AI command - create shape
		async () => {
			try {
				await page.keyboard.press('/');
				await page.waitForTimeout(300);
				
				const commands = [
					'create 2 red rectangles side by side',
					'generate a 3x3 grid of circles in a random color',
					'draw 3 pink shapes',
					'create a random shape somewhere',
					'add a text that says a random figma joke'
				];
				const command = commands[Math.floor(Math.random() * commands.length)];
				
				await page.keyboard.type(command);
				await page.keyboard.press('Enter');
				await page.waitForTimeout(2000); // Wait for AI
			} catch (error) {
				// AI might be busy or rate limited
			}
		},
		
		// Select and move shape - SLOWER, MORE DRAMATIC
		async () => {
			const selectButton = page.getByRole('button', { name: /select/i, exact: true });
			await selectButton.first().click();
			await page.waitForTimeout(200 + Math.random() * 300);
			
			const canvas = page.locator('canvas').first();
			const box = await canvas.boundingBox();
			if (box) {
				const x = box.x + box.width / 2 + (Math.random() - 0.5) * 400;
				const y = box.y + box.height / 2 + (Math.random() - 0.5) * 400;
				
				// Move to position slowly
				await page.mouse.move(x, y, { steps: 15 });
				await page.waitForTimeout(200);
				await page.mouse.click(x, y);
				await page.waitForTimeout(300 + Math.random() * 300);
				
				// Drag with larger distance and slower movement
				const dragDistance = 100 + Math.random() * 250; // Much farther!
				const dragAngle = Math.random() * Math.PI * 2;
				const targetX = x + Math.cos(dragAngle) * dragDistance;
				const targetY = y + Math.sin(dragAngle) * dragDistance;
				
				await page.mouse.down();
				await page.waitForTimeout(100);
				// Much slower drag
				await page.mouse.move(targetX, targetY, { steps: 30 + Math.floor(Math.random() * 30) });
				await page.waitForTimeout(100);
				await page.mouse.up();
			}
		},
		
		// Pan canvas - SLOWER, FARTHER
		async () => {
			const canvas = page.locator('canvas').first();
			const box = await canvas.boundingBox();
			if (box) {
				const x = box.x + box.width / 2;
				const y = box.y + box.height / 2;
				// Much bigger pan distance
				const panX = (Math.random() - 0.5) * 400;
				const panY = (Math.random() - 0.5) * 400;
				
				await page.mouse.move(x, y, { steps: 10 });
				await page.waitForTimeout(200);
				await page.mouse.down();
				await page.waitForTimeout(150);
				// Slower pan
				await page.mouse.move(x + panX, y + panY, { steps: 35 + Math.floor(Math.random() * 25) });
				await page.waitForTimeout(100);
				await page.mouse.up();
			}
		},
	];
	
	while (Date.now() - startTime < duration) {
		// Pick random action with weights (favor cursor movements for more presence updates)
		const actionIndex = Math.floor(Math.random() * actions.length);
		const action = actions[actionIndex];
		
		try {
			await action();
		} catch (error) {
			// Expected - shapes might not exist, race conditions, etc.
		}
		
		// Much more varied pause times between actions (800ms - 4000ms)
		// Longer pauses = more dramatic, less chaotic
		const pauseTime = 800 + Math.random() * 3200;
		await page.waitForTimeout(pauseTime);
	}
}

// Setup test - run ONCE to create test users
test.describe.skip('Setup: Create Test Users', () => {
	for (let i = 0; i < NUM_USERS; i++) {
		test(`Create user ${i + 1}`, async ({ browser }) => {
			if (!SIGNUP_USERS) {
				test.skip();
				return;
			}
			
			const context = await browser.newContext();
			const page = await context.newPage();
			
			const user = TEST_USERS[i];
			console.log(`Creating user: ${user.username} (${user.firstName} ${user.lastName})`);
			
			await signupUser(page, user.username, user.firstName, user.lastName, TEST_PASSWORD);
			
			console.log(`✓ Created ${user.username}`);
			
			await context.close();
		});
	}
});

// Main stress demo - 5 users in parallel (perfect for local dev)
test.describe.skip('Visual Stress Demo - 5 Users', () => {
	// Create a test for each user so they run in parallel with --workers=5
	for (let i = 0; i < NUM_USERS; i++) {
		test(`User ${i + 1}: ${TEST_USERS[i].firstName} ${TEST_USERS[i].lastName}`, async ({ browser }) => {
			const context = await browser.newContext({
				viewport: { width: 1280, height: 720 }
			});
			const page = await context.newPage();
			
			const user = TEST_USERS[i];
			console.log(`[User ${i + 1}] ${user.firstName} signing in...`);
			
			// Sign in
			await signinUser(page, user.username, TEST_PASSWORD);
			
			console.log(`[User ${i + 1}] ${user.firstName} started actions`);
			
			// Perform random actions
			await performRandomActions(page, DEMO_DURATION_MS);
			
			console.log(`[User ${i + 1}] ${user.firstName} completed`);
						
			await context.close();
		});
	}
});

// Super stress test - 30 users (optional, run with --workers=30)
test.describe.skip('Visual Stress Demo - 30 Users', () => {
	for (let i = 0; i < 30; i++) {
		test(`User ${i + 1}: ${TEST_USERS[i].firstName} ${TEST_USERS[i].lastName}`, async ({ browser }) => {
			const context = await browser.newContext({
				viewport: { width: 1280, height: 720 }
			});
			const page = await context.newPage();
			
			const user = TEST_USERS[i];
			console.log(`[User ${i + 1}] ${user.firstName} signing in...`);
			
			// Sign in
			await signinUser(page, user.username, TEST_PASSWORD);
			
			console.log(`[User ${i + 1}] ${user.firstName} started actions (60s)`);
			
			// Perform random actions for 60 seconds
			await performRandomActions(page, 60000);
			
			console.log(`[User ${i + 1}] ${user.firstName} completed`);
			
			// Check still connected
			const presenceUsers = await page.locator('[data-testid="presence-user"]').count().catch(() => 0);
			console.log(`[User ${i + 1}] Sees ${presenceUsers} users in presence bar`);
			
			expect(presenceUsers).toBeGreaterThan(0);
			
			await context.close();
		});
	}
});

