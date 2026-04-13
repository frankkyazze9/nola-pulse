import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-1">Dark Horse</h1>
        <p className="text-sm text-muted mb-6">Internal research tool</p>
        <LoginForm />
      </div>
    </div>
  );
}
