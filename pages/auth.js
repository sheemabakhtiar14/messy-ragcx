"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "your-supabase-url",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "your-supabase-anon-key"
);

function PasswordInput({ placeholder }) {
  const [show, setShow] = useState(false);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        type={show ? "text" : "password"}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "12px 48px 12px 16px",
          borderRadius: "12px",
          border: "1px solid #D1D5DB",
          outline: "none",
          color: "#1F2937",
          backgroundColor: "#F9FAFB",
          boxSizing: "border-box",
          fontSize: "16px",
        }}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        style={{
          position: "absolute",
          right: "16px",
          top: "50%",
          transform: "translateY(-50%)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6B7280",
        }}
      >
        {show ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
}

export default function AuthPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    setMounted(true);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!mounted) return null; // ✅ prevent hydration mismatch

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) console.error("Error signing in with Google:", error.message);
    } catch (err) {
      console.error("Google sign-in error:", err);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    window.location.href = "/";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
      }}
    >
      {/* Left: Form */}
      <div
        style={{
          flex: "1",
          width: isMobile ? "100%" : "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fff",
          padding: "32px",
        }}
      >
        <motion.div
          key="login"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            width: "100%",
            maxWidth: "400px",
            margin: "0 auto",
          }}
        >
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <img src="/z-logo.svg" alt="RAG.CX" style={{ height: "48px" }} />
            <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "4px" }}>
              RAG.CX
            </div>
          </div>

          <h2
            style={{
              fontSize: "30px",
              fontWeight: "700",
              color: "#111827",
              textAlign: "center",
              marginBottom: "24px",
            }}
          >
            Welcome Back
          </h2>

          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              width: "100%",
              margin: "0 auto",
            }}
          >
            <input
              name="email"
              type="email"
              placeholder="Email Address"
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "12px",
                border: "1px solid #D1D5DB",
                outline: "none",
                color: "#1F2937",
                backgroundColor: "#F9FAFB",
                boxSizing: "border-box",
                fontSize: "16px",
              }}
            />
            <PasswordInput placeholder="Password" />

            <button
              type="submit"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                backgroundColor: "#000",
                color: "#fff",
                fontWeight: "600",
                boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                transition: "all 0.2s ease",
                border: "none",
                cursor: "pointer",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor = "#1F2937")
              }
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#000")}
            >
              Login
            </button>

            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                margin: "24px 0",
              }}
            >
              <div style={{ flex: 1, height: "1px", background: "#E5E7EB" }}></div>
              <span style={{ color: "#9CA3AF", fontSize: "14px" }}>OR</span>
              <div style={{ flex: 1, height: "1px", background: "#E5E7EB" }}></div>
            </div>

            {/* Google Login */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid #D1D5DB",
                backgroundColor: "#fff",
                color: "#374151",
                fontWeight: "600",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s ease",
                cursor: "pointer",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor = "#F9FAFB")
              }
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
            >
              <FcGoogle size={22} /> Continue with Google
            </button>
          </form>

          <p
            style={{
              textAlign: "center",
              color: "#4B5563",
              marginTop: "16px",
            }}
          >
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => (window.location.href = "/signup")}
              style={{
                fontWeight: "600",
                color: "#000",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Sign Up
            </button>
          </p>
        </motion.div>
      </div>

      {/* Right: Showcase (hidden on mobile) */}
      {!isMobile && (
        <div
          style={{
            flex: "1",
            width: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(to bottom right, #000, #111827, #1F2937)",
            color: "#fff",
            padding: "32px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Gradient blobs */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "288px",
              height: "288px",
              background: "#9333EA",
              borderRadius: "9999px",
              filter: "blur(48px)",
              opacity: 0.3,
            }}
          ></div>
          <div
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: "288px",
              height: "288px",
              background: "#3B82F6",
              borderRadius: "9999px",
              filter: "blur(48px)",
              opacity: 0.3,
            }}
          ></div>

          <div
            style={{
              maxWidth: "600px",
              textAlign: "center",
              position: "relative",
              zIndex: 10,
            }}
          >
            <h2
              style={{
                fontSize: "36px",
                fontWeight: "800",
                lineHeight: "1.2",
                marginBottom: "16px",
              }}
            >
              Build Intelligent{" "}
              <span
                style={{
                  background: "linear-gradient(to right, #A78BFA, #60A5FA)",
                  WebkitBackgroundClip: "text",
                  color: "transparent",
                }}
              >
                RAG Widgets
              </span>
            </h2>
            <p style={{ fontSize: "18px", color: "#D1D5DB" }}>
              RAG.CX is a fast, seamless widget generator for building intuitive
              knowledge retrieval products.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2,1fr)",
                gap: "16px",
                marginTop: "32px",
              }}
            >
              {[
                { title: "⚡ Faster", desc: "Deploy widgets in minutes" },
                { title: "🤖 Intelligent", desc: "AI-driven knowledge retrieval" },
                { title: "🎨 Intuitive", desc: "No-code, drag-and-drop setup" },
                { title: "🔒 Secure", desc: "Enterprise-grade reliability" },
              ].map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.2 }}
                  whileHover={{ scale: 1.05 }}
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: "16px",
                    padding: "16px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                    cursor: "default",
                  }}
                >
                  <h4
                    style={{
                      fontWeight: "600",
                      color: "#fff",
                      marginBottom: "4px",
                    }}
                  >
                    {f.title}
                  </h4>
                  <p style={{ fontSize: "14px", color: "#D1D5DB" }}>{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
