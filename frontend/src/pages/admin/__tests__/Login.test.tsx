import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "../Login";
import { useAuth } from "../../../contexts/AuthContext";

// Mock the entire AuthContext module. This also prevents supabase.ts from
// running its env var guard (it would throw without VITE_SUPABASE_URL set).
vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

// Keep real react-router-dom exports; only replace useNavigate.
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

type AuthShape = ReturnType<typeof useAuth>;

function mockAuth(overrides: Partial<AuthShape> = {}) {
  (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
    session: null,
    user: null,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  } satisfies AuthShape);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Login mode ────────────────────────────────────────────────────────────────

it("calls signIn with email and password on login submit", async () => {
  const mockSignIn = vi.fn().mockResolvedValue(undefined);
  mockAuth({ signIn: mockSignIn });
  const user = userEvent.setup();

  render(<Login />);

  await user.type(screen.getByLabelText(/email/i), "test@example.com");
  await user.type(screen.getByLabelText(/password/i), "password123");
  await user.click(screen.getByRole("button", { name: /sign in/i }));

  expect(mockSignIn).toHaveBeenCalledOnce();
  expect(mockSignIn).toHaveBeenCalledWith("test@example.com", "password123");
});

// ── Signup mode ───────────────────────────────────────────────────────────────

it("calls signUp on signup submit and transitions to verify state", async () => {
  const mockSignUp = vi.fn().mockResolvedValue(undefined);
  mockAuth({ signUp: mockSignUp });
  const user = userEvent.setup();

  render(<Login />);

  await user.click(screen.getByRole("button", { name: /create account/i }));

  await user.type(screen.getByLabelText(/email/i), "new@example.com");
  await user.type(screen.getByLabelText(/password/i), "newpassword");
  await user.click(screen.getByRole("button", { name: /create account/i }));

  expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "newpassword");
  expect(screen.getByText(/check your email/i)).toBeInTheDocument();
});

// ── Verify state ──────────────────────────────────────────────────────────────

it("resend in verify state calls signUp again", async () => {
  const mockSignUp = vi.fn().mockResolvedValue(undefined);
  mockAuth({ signUp: mockSignUp });
  const user = userEvent.setup();

  render(<Login />);

  await user.click(screen.getByRole("button", { name: /create account/i }));
  await user.type(screen.getByLabelText(/email/i), "user@example.com");
  await user.type(screen.getByLabelText(/password/i), "pass");
  await user.click(screen.getByRole("button", { name: /create account/i }));

  await user.click(screen.getByRole("button", { name: /resend/i }));

  expect(mockSignUp).toHaveBeenCalledTimes(2);
});

// ── Error display ─────────────────────────────────────────────────────────────

it("shows error message when signIn rejects", async () => {
  const mockSignIn = vi.fn().mockRejectedValue(new Error("Invalid credentials"));
  mockAuth({ signIn: mockSignIn });
  const user = userEvent.setup();

  render(<Login />);

  await user.type(screen.getByLabelText(/email/i), "bad@example.com");
  await user.type(screen.getByLabelText(/password/i), "wrongpass");
  await user.click(screen.getByRole("button", { name: /sign in/i }));

  expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
});
