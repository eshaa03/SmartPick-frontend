import { useState } from "react";
import { motion } from "motion/react";
import { Mail, Lock, Eye, EyeOff, Sparkles, User, ArrowRight } from "lucide-react";
import { registerUser } from "../../../api/auth";

export function RegisterPage({ onRegister, onSwitchToLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  const validateForm = () => {
    const newErrors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    }

    if (!trimmedEmail) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = "Please enter a valid email";
    }

    if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const res = await registerUser({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      onRegister(res.data.user);
    } catch (err) {
      setFormError(err.response?.data?.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 auth-animated-gradient animated-gradient" />

        {/* Floating Particles */}
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 auth-particle rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Register Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass-strong rounded-3xl p-8 shadow-2xl auth-card">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl auth-orb flex items-center justify-center glow-blue-subtle">
              <Sparkles className="w-6 h-6 auth-orb-icon" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-100">
                SmartPick
              </h1>
              <p className="text-xs text-slate-400">
                AI Shopping Assistant
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-slate-100 mb-2 text-center">
            Create Account
          </h2>
          <p className="text-slate-400 text-center mb-8">
            Start your smart shopping journey
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {formError}
              </div>
            )}
            {/* Name */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                    if (formError) setFormError("");
                  }}
                  placeholder="John Doe"
                  className={`w-full pl-12 pr-4 py-3 rounded-xl glass border ${
                    errors.name ? "border-red-500" : "border-slate-700"
                  } text-slate-100 placeholder-slate-500 focus:border-teal-400 focus:outline-none transition-colors`}
                  required
                />
              </div>
              {errors.name && (
                <p className="text-red-400 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                    if (formError) setFormError("");
                  }}
                  placeholder="your@email.com"
                  className={`w-full pl-12 pr-4 py-3 rounded-xl glass border ${
                    errors.email ? "border-red-500" : "border-slate-700"
                  } text-slate-100 placeholder-slate-500 focus:border-teal-400 focus:outline-none transition-colors`}
                  required
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: "" }));
                    if (errors.confirmPassword && confirmPassword) {
                      setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                    }
                    if (formError) setFormError("");
                  }}
                  placeholder="********"
                  className={`w-full pl-12 pr-12 py-3 rounded-xl glass border ${
                    errors.password ? "border-red-500" : "border-slate-700"
                  } text-slate-100 placeholder-slate-500 focus:border-teal-400 focus:outline-none transition-colors`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) {
                      setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                    }
                    if (formError) setFormError("");
                  }}
                  placeholder="********"
                  className={`w-full pl-12 pr-4 py-3 rounded-xl glass border ${
                    errors.confirmPassword
                      ? "border-red-500"
                      : "border-slate-700"
                  } text-slate-100 placeholder-slate-500 focus:border-teal-400 focus:outline-none transition-colors`}
                  required
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-red-400 text-xs mt-1">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-600 to-sky-600 text-white font-medium flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-teal-500/30 transition-shadow disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </form>

          {/* Login Link */}
          <p className="text-center text-slate-400 mt-6">
            Already have an account?{" "}
            <button
              onClick={onSwitchToLogin}
              className="text-teal-400 hover:text-teal-300 font-medium transition-colors"
            >
              Sign in
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
