import { useState, useEffect } from "react";
import type { CustomerFeatureMap, ReliabilityLevel } from "../services/api";
import { usePrototypeFrieScore, type PrototypeFrieScoreState } from "../hooks/usePrototypeFrieScore";
import { listDevSampleRecords, type DevSampleMeta, type FrieIndicators } from "../services/devSampleFeatures";
import {
  Activity, AlertCircle, AlertTriangle, ArrowDown, ArrowUp,
  BarChart2, Bell, Briefcase, Building2, Check,
  CheckCircle, ChevronRight, Clock, CreditCard, DollarSign,
  Download, Eye, EyeOff, FileText, Heart, HelpCircle,
  Info, LayoutDashboard, LogOut, MessageSquare, Percent,
  Search, Settings, Shield, Star, TrendingDown, TrendingUp,
  Upload, User, Users, X, XCircle, Zap
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import svgPaths from "@/imports/RightSplit/svg-qcu94pqgtn";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type Role = "individual" | "bank" | "nbfc" | "insurance";
type View =
  | "dashboard" | "score" | "documents" | "analysis"
  | "recommendations" | "history" | "customers" | "customer-detail"
  | "reports" | "settings" | "notifications" | "profile"
  | "applications" | "risk" | "select-customer";

interface AuthUser { email: string; role: Role; name: string }

interface CustomerComponents {
  incomeStability: number; creditBehaviour: number; savingsDiscipline: number;
  paymentDiscipline: number; debtBurden: number; financialResilience: number;
  insuranceProtection: number; investmentBehaviour: number;
}

interface Customer {
  id: string; name: string; email: string; age: number; occupation: string;
  frieScore: number; confidence: number;
  monthlyIncome: number; monthlyExpenses: number; savings: number;
  existingDebt: number; emi: number; creditScore: number;
  savingsRate: number; debtToIncome: number;
  riskLevel: "Low" | "Medium" | "High";
  components: CustomerComponents;
}

// ═══════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════

const DEMO_ACCOUNTS: Record<string, { password: string; role: Role; name: string }> = {
  "individual@frie.demo": { password: "FRIE123", role: "individual", name: "Prototype Customer" },
};

const DEMO_COMPONENTS: CustomerComponents = {
  incomeStability: 85, creditBehaviour: 80, savingsDiscipline: 88, paymentDiscipline: 90,
  debtBurden: 72, financialResilience: 78, insuranceProtection: 65, investmentBehaviour: 80,
};

const DEMO_CUSTOMERS: Customer[] = [
  {
    id: "C001", name: "Priya Sharma", email: "priya.sharma@example.com", age: 32, occupation: "Software Engineer",
    frieScore: 82, confidence: 91,
    monthlyIncome: 95000, monthlyExpenses: 45000, savings: 50000,
    existingDebt: 1200000, emi: 18000, creditScore: 748,
    savingsRate: 52.6, debtToIncome: 1.05, riskLevel: "Low",
    components: DEMO_COMPONENTS,
  },
  {
    id: "C002", name: "Rahul Mehta", email: "rahul.mehta@example.com", age: 41, occupation: "Sales Manager",
    frieScore: 65, confidence: 84,
    monthlyIncome: 60000, monthlyExpenses: 42000, savings: 18000,
    existingDebt: 2800000, emi: 32000, creditScore: 680,
    savingsRate: 30.0, debtToIncome: 3.9, riskLevel: "Medium",
    components: { incomeStability: 70, creditBehaviour: 62, savingsDiscipline: 55, paymentDiscipline: 68, debtBurden: 48, financialResilience: 58, insuranceProtection: 72, investmentBehaviour: 50 },
  },
  {
    id: "C003", name: "Suresh Kumar", email: "suresh.kumar@example.com", age: 29, occupation: "Small Business Owner",
    frieScore: 43, confidence: 76,
    monthlyIncome: 35000, monthlyExpenses: 33000, savings: 2000,
    existingDebt: 850000, emi: 18500, creditScore: 590,
    savingsRate: 5.7, debtToIncome: 2.0, riskLevel: "High",
    components: { incomeStability: 50, creditBehaviour: 38, savingsDiscipline: 25, paymentDiscipline: 42, debtBurden: 35, financialResilience: 30, insuranceProtection: 20, investmentBehaviour: 15 },
  },
];

const SCORE_HISTORY = [
  { month: "Feb", score: 74 }, { month: "Mar", score: 76 },
  { month: "Apr", score: 79 }, { month: "May", score: 78 },
  { month: "Jun", score: 81 }, { month: "Jul", score: 82 },
];

const VIEW_TITLES: Partial<Record<View, string>> = {
  dashboard: "Dashboard", score: "FRIE Score & Report", documents: "Document Upload",
  analysis: "Financial Analysis", recommendations: "Recommendations", history: "History",
  customers: "Customers", "customer-detail": "Customer Profile", reports: "Reports",
  settings: "Settings", notifications: "Notifications", profile: "My Profile",
  applications: "Loan Applications", risk: "Risk Indicators",
  "select-customer": "Select Prototype Customer",
};

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function scoreColor(s: number) {
  if (s >= 85) return "#10B981";
  if (s >= 70) return "#3B82F6";
  if (s >= 55) return "#F59E0B";
  return "#EF4444";
}
function scoreLabel(s: number) {
  if (s >= 85) return "Excellent";
  if (s >= 70) return "Good";
  if (s >= 55) return "Fair";
  return "Poor";
}
function scoreBadgeCls(s: number) {
  if (s >= 85) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (s >= 70) return "bg-blue-50 text-blue-700 border-blue-100";
  if (s >= 55) return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-red-50 text-red-700 border-red-100";
}
function reliabilityColor(level: ReliabilityLevel) {
  if (level === "Excellent") return "#10B981";
  if (level === "Good") return "#3B82F6";
  if (level === "Average") return "#F59E0B";
  return "#EF4444";
}
function reliabilityBadgeCls(level: ReliabilityLevel) {
  if (level === "Excellent") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (level === "Good") return "bg-blue-50 text-blue-700 border-blue-100";
  if (level === "Average") return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-red-50 text-red-700 border-red-100";
}
function riskBadgeCls(r: string) {
  if (r === "Low")    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (r === "Medium") return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-red-50 text-red-700 border-red-100";
}
function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

function featureNumber(features: CustomerFeatureMap | null, key: string): number | null {
  if (!features) return null;
  const value = features[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function fmtFeature(features: CustomerFeatureMap | null, key: string): string {
  const value = featureNumber(features, key);
  return value === null ? "—" : fmt(value);
}

function pctFeature(features: CustomerFeatureMap | null, key: string, digits = 1): string {
  const value = featureNumber(features, key);
  return value === null ? "—" : `${(value * 100).toFixed(digits)}%`;
}

function yearsFeature(features: CustomerFeatureMap | null, key: string): string {
  const value = featureNumber(features, key);
  return value === null ? "—" : `${value.toFixed(1)} yrs`;
}

function decimalFeature(features: CustomerFeatureMap | null, key: string, digits = 2): string {
  const value = featureNumber(features, key);
  return value === null ? "—" : value.toFixed(digits);
}

const ILLUSTRATIVE_DEMO = "(illustrative demo)";

// ═══════════════════════════════════════════════════════════════
// SMALL SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════

function ScoreGauge({ score, reliabilityLevel, size = 200 }: { score: number; reliabilityLevel: ReliabilityLevel; size?: number }) {
  const r = size * 0.39;
  const cx = size / 2;
  const cy = size * 0.52;
  const circ = Math.PI * r;
  const offset = circ * (1 - Math.min(Math.max(score, 0), 100) / 100);
  const col = reliabilityColor(reliabilityLevel);
  const lbl = reliabilityLevel;
  const path = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`}>
      <path d={path} fill="none" stroke="#F1F5F9" strokeWidth="13" strokeLinecap="round" />
      <path d={path} fill="none" stroke={col} strokeWidth="13" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      <text x={cx} y={cy - 14} textAnchor="middle"
        fontSize={size * 0.19} fontWeight="800" fill="#0F172A" fontFamily="Outfit, sans-serif">
        {score}
      </text>
      <text x={cx} y={cy + 13} textAnchor="middle"
        fontSize={size * 0.068} fontWeight="600" fill={col} fontFamily="Geist, Inter, sans-serif">
        {lbl}
      </text>
    </svg>
  );
}

const COMP_META: Record<string, { label: string; icon: React.ElementType }> = {
  incomeStability:    { label: "Income Stability",     icon: TrendingUp },
  creditBehaviour:    { label: "Credit Behaviour",     icon: CreditCard },
  savingsDiscipline:  { label: "Savings Discipline",   icon: DollarSign },
  paymentDiscipline:  { label: "Payment Discipline",   icon: CheckCircle },
  debtBurden:         { label: "Debt Burden",          icon: AlertTriangle },
  financialResilience:{ label: "Financial Resilience", icon: Shield },
  insuranceProtection:{ label: "Insurance Protection", icon: Heart },
  investmentBehaviour:{ label: "Investment Behaviour", icon: BarChart2 },
};

function CompBar({ label, score, icon: Icon }: { label: string; score: number; icon: React.ElementType }) {
  const col = scoreColor(score);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={12} className="text-slate-400" />
          <span className="text-[12px] font-semibold text-slate-600">{label}</span>
        </div>
        <span className="text-[12px] font-bold" style={{ color: col }}>{score}<span className="font-medium text-slate-400">/100</span></span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(score, 0), 100)}%`, backgroundColor: col }} />
      </div>
    </div>
  );
}

const INDICATOR_META: { key: keyof FrieIndicators; label: string; icon: React.ElementType }[] = [
  { key: "incomeStability",     label: "Income Stability",     icon: TrendingUp },
  { key: "savingsDiscipline",   label: "Savings Discipline",   icon: DollarSign },
  { key: "debtBurden",          label: "Debt Burden",          icon: AlertTriangle },
  { key: "commitmentAdherence", label: "Commitment Adherence", icon: Shield },
  { key: "cashflowStability",   label: "Cash-flow Stability",  icon: Activity },
  { key: "paymentDiscipline",   label: "Payment Discipline",   icon: CheckCircle },
  { key: "financialStress",     label: "Financial Stress",     icon: Heart },
  { key: "financialResilience", label: "Financial Resilience", icon: BarChart2 },
];

function IndicatorBreakdown({ state }: { state: PrototypeFrieScoreState }) {
  if (state.status === "loading" || state.status === "idle") {
    return (
      <div className="bg-white rounded-xl border border-[#F1F5F9] p-6">
        <h3 className="text-[14px] font-bold text-[#0F172A] mb-4">FRIE Indicator Breakdown</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="h-3 rounded bg-slate-100 animate-pulse w-2/3" />
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full w-1/3 bg-slate-200 rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (state.status === "error" || !state.indicators) {
    return (
      <div className="bg-white rounded-xl border border-[#F1F5F9] p-6">
        <h3 className="text-[14px] font-bold text-[#0F172A] mb-2">FRIE Indicator Breakdown</h3>
        <p className="text-[13px] text-slate-500">Indicator breakdown unavailable</p>
      </div>
    );
  }
  const indicators = state.indicators;
  return (
    <div className="bg-white rounded-xl border border-[#F1F5F9] p-6">
      <h3 className="text-[14px] font-bold text-[#0F172A]">FRIE Indicator Breakdown</h3>
      <p className="text-[12px] text-slate-500 mt-1 mb-4">
        Derived from selected dataset record — FRIE scoring-engine indicators. The FRIE Score above is the V2 XGBoost prediction.
      </p>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        {[INDICATOR_META.slice(0, 4), INDICATOR_META.slice(4)].map((column, ci) => (
          <div key={ci} className="flex flex-col gap-4">
            {column.map(({ key, label, icon }) => (
              <CompBar key={key} label={label} score={Math.round(indicators[key])} icon={icon} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const STAT_ICON_CLS: Record<string, string> = {
  blue:  "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red:   "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-600",
};

function Stat({ title, value, sub, icon: Icon, variant = "blue" }: {
  title: string; value: string; sub?: string; icon: React.ElementType; variant?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#F1F5F9] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-slate-500 font-medium">{title}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${STAT_ICON_CLS[variant] || STAT_ICON_CLS.blue}`}>
          <Icon size={16} />
        </div>
      </div>
      <div>
        <p className="text-[22px] font-extrabold text-[#0F172A]" style={{ fontFamily: "Outfit, sans-serif" }}>{value}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${checked ? "bg-[#0F172A]" : "bg-slate-200"}`}
      aria-pressed={checked}
    >
      <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-1 transition-all ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// LOGIN PAGE
// ═══════════════════════════════════════════════════════════════

function LoginPage({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [remember, setRemember]       = useState(false);
  const [error, setError]             = useState("");

  function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const key = email.toLowerCase().trim();
    const account = DEMO_ACCOUNTS[key];
    if (!account || account.password !== password) {
      setError("Invalid credentials. Use the Individual demo account below.");
      return;
    }
    onLogin({ email: key, role: account.role, name: account.name });
  }

  const hints: { email: string; label: string }[] = [
    { email: "individual@frie.demo", label: "Individual" },
  ];

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-[460px] shrink-0 bg-[#0F172A] p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-blue-400/8 rounded-full translate-y-1/2 -translate-x-1/3" />

        {/* Logo */}
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#3B82F6] rounded-xl flex items-center justify-center">
              <Activity size={22} className="text-white" />
            </div>
            <span className="text-white text-2xl font-extrabold tracking-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
              FRIE
            </span>
          </div>
          <p className="text-slate-400 text-[13px] ml-0.5">Financial Reliability Intelligence Engine</p>
        </div>

        {/* Main copy */}
        <div className="relative space-y-8">
          <div>
            <h2 className="text-white text-[30px] font-extrabold leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
              Know your financial<br />reliability score.
            </h2>
            <p className="text-slate-400 text-[14px] mt-3 leading-relaxed">
              Prototype scoring of dataset-backed financial records through the saved FRIE XGBoost pipeline — consolidated into a single reliability index.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: Zap,      title: "FRIE Score",         desc: "Composite reliability index from 0–100" },
              { icon: Shield,   title: "Dataset-backed Prototype", desc: "Scores computed from local FRIE ML test records" },
              { icon: Activity, title: "Backend Prediction", desc: "Scores returned by the FRIE FastAPI service" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={15} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-white text-[13px] font-semibold">{title}</p>
                  <p className="text-slate-500 text-[12px] mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 pt-5 border-t border-slate-800">
            {[{ val: "98", lbl: "Model Features" }, { val: "V2", lbl: "XGBoost Pipeline" }, { val: "S3", lbl: "Prototype Demo" }].map(({ val, lbl }) => (
              <div key={lbl} className="text-center">
                <p className="text-white text-[18px] font-extrabold" style={{ fontFamily: "Outfit, sans-serif" }}>{val}</p>
                <p className="text-slate-500 text-[11px]">{lbl}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-700 text-[11px] relative">© 2025 FRIE. For demonstration purposes only.</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-between p-8 lg:p-16 overflow-y-auto">
        <form onSubmit={handleSignIn} className="w-full max-w-[400px] flex flex-col gap-8">
          {/* Header */}
          <div className="flex flex-col gap-3">
            <p className="font-extrabold text-[#0F172A] text-[32px] leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
              Welcome Back
            </p>
            <p className="text-[#334155] text-[14px]" style={{ fontFamily: "Geist, Inter, sans-serif" }}>
              Sign in to your financial diagnostic portal
            </p>
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-[#0F172A] text-[13px]" style={{ fontFamily: "Geist, Inter, sans-serif" }}>
                Email Address
              </label>
              <div className="bg-[#F8FAFC] border border-[#F1F5F9] rounded-[8px] flex items-center gap-2.5 px-3 py-3 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-50 transition-all">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                  <path d={svgPaths.p10d0c00} stroke="#94A3B8" strokeLinecap="round" strokeWidth="2" />
                </svg>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="user@financialinstitution.com"
                  className="flex-1 bg-transparent text-[14px] text-[#334155] placeholder:text-[#94A3B8] outline-none"
                  style={{ fontFamily: "Geist, Inter, sans-serif" }}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-[#0F172A] text-[13px]" style={{ fontFamily: "Geist, Inter, sans-serif" }}>
                Security Password
              </label>
              <div className="bg-[#F8FAFC] border border-[#F1F5F9] rounded-[8px] flex items-center gap-2.5 px-3 py-3 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-50 transition-all">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                  <path d={svgPaths.p241025a0} stroke="#94A3B8" strokeLinecap="round" strokeWidth="2" />
                </svg>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="flex-1 bg-transparent text-[14px] text-[#334155] placeholder:text-[#94A3B8] outline-none"
                  style={{ fontFamily: "Geist, Inter, sans-serif" }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="font-bold text-[#3B82F6] text-[12px] hover:text-blue-700 transition-colors shrink-0"
                  style={{ fontFamily: "Geist, Inter, sans-serif" }}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Options row */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setRemember(!remember)}
                  className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-all shrink-0 ${remember ? "bg-[#0F172A] border-[#0F172A]" : "bg-white border-[#94A3B8]"}`}
                >
                  {remember && <Check size={10} className="text-white" />}
                </div>
                <span className="text-[#334155] text-[13px]" style={{ fontFamily: "Geist, Inter, sans-serif" }}>
                  Remember active workspace
                </span>
              </label>
              <button
                type="button"
                className="font-semibold text-[#3B82F6] text-[13px] hover:text-blue-700 transition-colors"
                style={{ fontFamily: "Geist, Inter, sans-serif" }}
              >
                Forgot Password?
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-600 text-[13px]">{error}</p>
                <p className="text-red-400 text-[11px] mt-1">All passwords: FRIE123</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-4">
            <button
              type="submit"
              className="bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-[14px] py-3 px-6 rounded-[8px] transition-colors w-full"
              style={{ fontFamily: "Geist, Inter, sans-serif" }}
            >
              Sign In Securely
            </button>

            {/* Divider */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-[#F1F5F9]" />
              <span className="text-[#94A3B8] text-[11px] uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: "Geist, Inter, sans-serif" }}>
                or authenticate with
              </span>
              <div className="flex-1 h-px bg-[#F1F5F9]" />
            </div>

            {/* Social buttons */}
            <div className="flex gap-3">
              {["Google SSO", "Microsoft Active Directory"].map(provider => (
                <button
                  key={provider}
                  type="button"
                  className="flex-1 bg-white border border-[#F1F5F9] rounded-[8px] flex items-center justify-center gap-2 py-3 px-2 hover:bg-[#F8FAFC] transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <g clipPath="url(#ssoClip)">
                      <path d={svgPaths.p30250f00} stroke="#0F172A" strokeLinecap="round" strokeWidth="2" />
                    </g>
                    <defs><clipPath id="ssoClip"><rect fill="white" height="16" width="16" /></clipPath></defs>
                  </svg>
                  <span className="font-semibold text-[#0F172A] text-[12px] whitespace-nowrap" style={{ fontFamily: "Geist, Inter, sans-serif" }}>
                    {provider}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Register */}
          <div className="flex items-center justify-center gap-1 text-[13px]">
            <span className="text-[#334155]" style={{ fontFamily: "Geist, Inter, sans-serif" }}>
              Don&apos;t have an enterprise workspace?
            </span>
            <button
              type="button"
              className="font-bold text-[#3B82F6] hover:text-blue-700 transition-colors"
              style={{ fontFamily: "Geist, Inter, sans-serif" }}
            >
              Register
            </button>
          </div>

          {/* Demo hint */}
          <div className="bg-[#F8FAFC] border border-[#F1F5F9] rounded-lg p-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Demo Credentials</p>
            <div className="flex flex-col gap-1.5">
              {hints.map(({ email: hEmail, label }) => (
                <button
                  key={hEmail}
                  type="button"
                  onClick={() => { setEmail(hEmail); setPassword("FRIE123"); setError(""); }}
                  className="text-left text-[11px] text-[#3B82F6] hover:text-blue-700 font-medium transition-colors"
                >
                  {label}: {hEmail} / FRIE123
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════

type NavItem = { icon: React.ElementType; label: string; view: View };

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  individual: [
    { icon: LayoutDashboard, label: "Dashboard",         view: "dashboard" },
    { icon: Star,            label: "FRIE Score",        view: "score" },
    { icon: TrendingUp,      label: "Financial Analysis",view: "analysis" },
    { icon: Users,           label: "Switch Customer",   view: "select-customer" },
  ],
  bank: [
    { icon: LayoutDashboard, label: "Dashboard",  view: "dashboard" },
    { icon: Users,           label: "Customers",  view: "customers" },
    { icon: FileText,        label: "Reports",    view: "reports" },
  ],
  nbfc: [
    { icon: LayoutDashboard, label: "Dashboard",     view: "dashboard" },
    { icon: Briefcase,       label: "Applications",  view: "applications" },
    { icon: AlertTriangle,   label: "Risk",          view: "risk" },
    { icon: FileText,        label: "Reports",       view: "reports" },
  ],
  insurance: [
    { icon: LayoutDashboard, label: "Dashboard",  view: "dashboard" },
    { icon: Users,           label: "Customers",  view: "customers" },
    { icon: FileText,        label: "Reports",    view: "reports" },
  ],
};

const ROLE_ACCENT: Record<Role, string> = {
  individual: "text-blue-400",
  bank:       "text-emerald-400",
  nbfc:       "text-amber-400",
  insurance:  "text-purple-400",
};

const ROLE_LABEL: Record<Role, string> = {
  individual: "Individual Portal",
  bank:       "Bank Portal",
  nbfc:       "NBFC Portal",
  insurance:  "Insurance Portal",
};

function Sidebar({ role, view, onNavigate, onLogout, userName }: {
  role: Role; view: View; onNavigate: (v: View) => void; onLogout: () => void; userName: string;
}) {
  const nav = NAV_BY_ROLE[role];

  function NavBtn({ item }: { item: NavItem }) {
    const active = view === item.view;
    return (
      <button
        onClick={() => onNavigate(item.view)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all mb-0.5 ${
          active ? "bg-[#0F172A] text-white" : "text-slate-500 hover:bg-slate-50 hover:text-[#0F172A]"
        }`}
      >
        <item.icon size={15} />
        <span className="text-[13px] font-semibold">{item.label}</span>
      </button>
    );
  }

  return (
    <div className="w-[224px] shrink-0 bg-white border-r border-[#F1F5F9] flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-[#0F172A] rounded-xl flex items-center justify-center">
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <p className="text-[#0F172A] font-extrabold text-[18px] leading-none" style={{ fontFamily: "Outfit, sans-serif" }}>FRIE</p>
            <p className={`text-[10px] font-semibold leading-none mt-0.5 ${ROLE_ACCENT[role]}`}>{ROLE_LABEL[role]}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest">Main Menu</p>
        {nav.map(item => <NavBtn key={item.view} item={item} />)}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-3 border-t border-[#F1F5F9]">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-[#0F172A] flex items-center justify-center text-white text-[12px] font-bold shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-[#0F172A] truncate">{userName}</p>
            <p className="text-[10px] text-slate-400 truncate">{ROLE_LABEL[role]}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-red-500 hover:bg-red-50 transition-all"
        >
          <LogOut size={15} />
          <span className="text-[13px] font-semibold">Logout</span>
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// APP LAYOUT
// ═══════════════════════════════════════════════════════════════

function AppLayout({ role, view, onNavigate, onLogout, userName, children }: {
  role: Role; view: View; onNavigate: (v: View) => void; onLogout: () => void;
  userName: string; children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <Sidebar role={role} view={view} onNavigate={onNavigate} onLogout={onLogout} userName={userName} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-[#F1F5F9] px-8 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-[18px] font-extrabold text-[#0F172A]" style={{ fontFamily: "Outfit, sans-serif" }}>
              {VIEW_TITLES[view] || "Dashboard"}
            </h1>
            <p className="text-[11px] text-slate-400">Financial Reliability Intelligence Engine</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate("select-customer")}
              className="h-9 px-4 bg-[#F8FAFC] border border-[#F1F5F9] rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors text-[13px] font-semibold text-[#0F172A]"
            >
              <Users size={15} className="text-slate-500" />
              Switch Customer
            </button>
            <div
              className="w-9 h-9 rounded-full bg-[#0F172A] flex items-center justify-center text-white text-[13px] font-bold"
            >
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CUSTOMER SELECTOR (dataset-backed prototype records)
// ═══════════════════════════════════════════════════════════════

function CustomerSelector({ selectedId, onSelect }: {
  selectedId: string | null;
  onSelect: (sampleId: string) => void;
}) {
  const [records, setRecords] = useState<DevSampleMeta[] | null>(null);
  const [error, setError]     = useState("");

  useEffect(() => {
    let live = true;
    setError("");
    listDevSampleRecords()
      .then(list => { if (live) setRecords(list); })
      .catch(err => {
        if (!live) return;
        setRecords([]);
        setError(err instanceof Error && err.message.trim() ? err.message : "Unable to load prototype customers.");
      });
    return () => { live = false; };
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white rounded-xl border border-[#F1F5F9] p-8">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">FRIE Individual Portal</p>
        <h2 className="text-[24px] font-extrabold text-[#0F172A]" style={{ fontFamily: "Outfit, sans-serif" }}>
          Select a prototype customer
        </h2>
        <p className="text-[13px] text-slate-500 mt-1.5">
          Dataset-backed prototype — only complete local FRIE ML test records with all 98 model features are listed.
        </p>

        {records === null && !error && (
          <div className="flex items-center gap-3 mt-6">
            <div className="w-5 h-5 border-2 border-[#0F172A] border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] font-semibold text-slate-600">Loading prototype customers...</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mt-6">
            <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-red-600 text-[13px]">{error}</p>
          </div>
        )}

        {records !== null && !error && records.length === 0 && (
          <p className="text-[13px] text-slate-500 mt-6">No complete prototype records are available.</p>
        )}

        {records !== null && !error && records.length > 0 && (
          <div className="mt-6">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
              {records.length} complete record{records.length === 1 ? "" : "s"} available
            </p>
            <div className="grid grid-cols-2 gap-3">
              {records.map(record => {
                const active = selectedId === record.sampleId;
                return (
                  <button
                    key={record.sampleId}
                    onClick={() => onSelect(record.sampleId)}
                    className={`text-left rounded-xl border p-4 transition-all ${
                      active
                        ? "bg-[#0F172A] text-white border-[#0F172A]"
                        : "bg-white text-[#0F172A] border-[#F1F5F9] hover:border-blue-200 hover:bg-blue-50/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>
                        {record.sampleId.replace("frie-test-record-", "Record ")}
                      </p>
                      <ChevronRight size={14} className={active ? "text-white" : "text-slate-300"} />
                    </div>
                    <p className={`text-[12px] mt-1 ${active ? "text-slate-300" : "text-slate-500"}`}>
                      Age {record.age_years === null ? "—" : Math.round(record.age_years)}
                      {" • "}
                      Income {record.monthly_income === null ? "—" : fmt(record.monthly_income)}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${active ? "text-slate-400" : "text-slate-400"}`}>
                      {record.occupation ?? "—"}
                      {" • "}
                      {record.employment_years === null ? "—" : `${record.employment_years.toFixed(1)} yrs`}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INDIVIDUAL DASHBOARD
// ═══════════════════════════════════════════════════════════════

function PrototypeScorePanel({
  state,
  size,
}: {
  state: PrototypeFrieScoreState;
  size: number;
}) {
  if (state.status === "loading" || state.status === "idle") {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3 min-h-[180px]">
        <div className="w-10 h-10 border-4 border-[#0F172A] border-t-transparent rounded-full animate-spin" />
        <p className="text-[13px] font-semibold text-slate-600">Calculating FRIE Score...</p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 min-h-[180px] text-center px-4">
        <AlertCircle size={22} className="text-red-500" />
        <p className="text-[13px] font-semibold text-red-700">Unable to calculate FRIE Score</p>
        <p className="text-[12px] text-slate-500">{state.message}</p>
      </div>
    );
  }
  return <ScoreGauge score={state.frieScore} reliabilityLevel={state.reliabilityLevel} size={size} />;
}

function IndividualDashboard({
  features,
  sampleId,
  onNavigate,
  prototypeScore,
}: {
  features: CustomerFeatureMap | null;
  sampleId: string | null;
  onNavigate: (v: View) => void;
  prototypeScore: PrototypeFrieScoreState;
}) {
  const ready = prototypeScore.status === "ready";
  const dti = featureNumber(features, "current_dti");
  const age = featureNumber(features, "age_years");
  const occupation = features && typeof features["occupation"] === "string" ? features["occupation"] as string : null;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#0F172A] text-white">
          Dataset-backed prototype
        </span>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white border border-[#F1F5F9] text-slate-500">
          Prediction generated by FRIE XGBoost
        </span>
      </div>
      {/* Row 1: Score + stats */}
      <div className="grid grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-[#F1F5F9] p-6 flex flex-col items-center">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Your FRIE Score</p>
          {sampleId && (
            <p className="text-[11px] text-slate-400 mb-1">
              {sampleId.replace("frie-test-record-", "Record ")}
              {age !== null && ` • Age ${Math.round(age)}`}
              {occupation && ` • ${occupation}`}
            </p>
          )}
          <PrototypeScorePanel state={prototypeScore} size={185} />
          <div className="flex items-center gap-5 mt-2 w-full justify-center">
            <div className="text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Savings Rate</p>
              <p className="text-[17px] font-extrabold text-[#0F172A]" style={{ fontFamily: "Outfit, sans-serif" }}>{pctFeature(features, "savings_rate")}</p>
            </div>
            <div className="w-px h-8 bg-[#F1F5F9]" />
            <div className="text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Category</p>
              <p
                className="text-[15px] font-extrabold"
                style={{
                  fontFamily: "Outfit, sans-serif",
                  color: ready ? reliabilityColor(prototypeScore.reliabilityLevel) : "#94A3B8",
                }}
              >
                {ready ? prototypeScore.reliabilityLevel : "—"}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate("score")}
            className="mt-3 text-[12px] font-semibold text-[#3B82F6] hover:text-blue-700 flex items-center gap-1 transition-colors"
          >
            Full Report <ChevronRight size={13} />
          </button>
        </div>

        <div className="col-span-2 flex flex-col gap-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Financial Snapshot — dataset record values</p>
          <div className="grid grid-cols-3 gap-4">
            <Stat title="Monthly Income"  value={fmtFeature(features, "monthly_income")}  sub="Dataset feature" icon={DollarSign} variant="green" />
            <Stat title="Monthly Savings" value={fmtFeature(features, "monthly_savings")} sub={`${pctFeature(features, "savings_rate")} of income`} icon={TrendingUp} variant="blue" />
            <Stat title="Savings Rate"    value={pctFeature(features, "savings_rate")}    sub="Dataset feature" icon={Percent} variant="green" />
            <Stat title="Employment"      value={yearsFeature(features, "employment_years")} sub="Dataset feature" icon={Briefcase} variant="amber" />
            <Stat title="Bureau Debt"     value={fmtFeature(features, "bureau_debt_amount")} sub={dti === null ? "Dataset feature" : `Debt-to-income ${dti.toFixed(2)}`} icon={AlertTriangle} variant="red" />
            <Stat title="Current DTI"     value={decimalFeature(features, "current_dti")} sub="Dataset feature" icon={Activity} variant="red" />
          </div>
        </div>
      </div>

      {/* Additional financial indicators */}
      <div className="bg-white rounded-xl border border-[#F1F5F9] p-6">
        <h3 className="text-[14px] font-bold text-[#0F172A] mb-4">Additional Financial Indicators</h3>
        <div className="grid grid-cols-4 gap-4">
          <Stat title="Total Expenses"    value={fmtFeature(features, "synthetic_total_expense")} sub="Dataset feature" icon={TrendingDown} variant="red" />
          <Stat title="Total EMI"         value={fmtFeature(features, "synthetic_total_emi")}     sub="Dataset feature" icon={CreditCard} variant="amber" />
          <Stat title="Available Surplus" value={fmtFeature(features, "available_surplus")}       sub="Dataset feature" icon={BarChart2} variant="blue" />
          <Stat title="Savings Balance"   value={fmtFeature(features, "savings_balance")}         sub="Dataset feature" icon={DollarSign} variant="green" />
          <Stat title="UPI Spending"      value={fmtFeature(features, "upi_spending")}            sub="Dataset feature" icon={Zap} variant="blue" />
          <Stat title="Insurance Premium" value={fmtFeature(features, "insurance_premium")}       sub="Dataset feature" icon={Shield} variant="amber" />
          <Stat title="SIP Contribution"  value={fmtFeature(features, "sip_contribution")}        sub="Dataset feature" icon={TrendingUp} variant="green" />
          <Stat title="Mutual Fund Balance" value={fmtFeature(features, "mutual_fund_balance")}   sub="Dataset feature" icon={BarChart2} variant="blue" />
        </div>
      </div>

      {/* FRIE Indicator Breakdown */}
      <IndicatorBreakdown state={prototypeScore} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT UPLOAD
// ═══════════════════════════════════════════════════════════════

type DocStatus = "none" | "uploading" | "uploaded" | "verified";

const DOC_TYPES: { id: string; label: string; icon: React.ElementType; required: boolean }[] = [
  { id: "pan",        label: "PAN Card",                icon: CreditCard,  required: true  },
  { id: "aadhaar",    label: "Aadhaar / Identity",       icon: User,        required: true  },
  { id: "salary",     label: "Salary Slip",              icon: DollarSign,  required: true  },
  { id: "bank",       label: "Bank Statement",           icon: Building2,   required: true  },
  { id: "cibil",      label: "CIBIL / Credit Report",   icon: BarChart2,   required: true  },
  { id: "insurance",  label: "Insurance Document",       icon: Shield,      required: false },
  { id: "investment", label: "Investment Statement",     icon: TrendingUp,  required: false },
];

function DocumentUpload({ onAnalyze }: { onAnalyze: () => void }) {
  const [statuses, setStatuses] = useState<Record<string, DocStatus>>({});

  function handleUpload(id: string) {
    setStatuses(s => ({ ...s, [id]: "uploading" }));
    setTimeout(() => {
      setStatuses(s => ({ ...s, [id]: "uploaded" }));
      setTimeout(() => setStatuses(s => ({ ...s, [id]: "verified" })), 1500);
    }, 1800);
  }

  const verifiedCount = Object.values(statuses).filter(s => s === "verified").length;
  const canAnalyze = DOC_TYPES.filter(d => d.required).every(d => statuses[d.id] === "verified");

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Progress */}
      <div className="bg-white rounded-xl border border-[#F1F5F9] p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-semibold text-[#0F172A]">Upload Progress</p>
          <p className="text-[12px] text-slate-500">{verifiedCount} / {DOC_TYPES.length} verified</p>
        </div>
        <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#3B82F6] rounded-full transition-all duration-500"
            style={{ width: `${(verifiedCount / DOC_TYPES.length) * 100}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">* 5 required documents needed for FRIE analysis</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-4">
        {DOC_TYPES.map(({ id, label, icon: Icon, required }) => {
          const status = statuses[id] || "none";
          return (
            <div key={id} className="bg-white rounded-xl border border-[#F1F5F9] p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-[#F8FAFC] rounded-lg flex items-center justify-center">
                    <Icon size={16} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#0F172A]">{label}</p>
                    <p className="text-[10px] text-slate-400">{required ? "Required" : "Optional"}</p>
                  </div>
                </div>
                {status === "verified" && (
                  <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle size={10} /> Verified
                  </span>
                )}
                {status === "uploaded" && (
                  <span className="bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    Checking...
                  </span>
                )}
              </div>

              {status === "none" && (
                <button
                  onClick={() => handleUpload(id)}
                  className="w-full border-2 border-dashed border-[#F1F5F9] hover:border-blue-200 hover:bg-blue-50 rounded-lg py-3 flex flex-col items-center gap-1.5 transition-all group"
                >
                  <Upload size={15} className="text-slate-400 group-hover:text-blue-400" />
                  <span className="text-[12px] text-slate-400 group-hover:text-blue-500 font-medium">Click to upload</span>
                </button>
              )}
              {status === "uploading" && (
                <div className="w-full border border-[#F1F5F9] rounded-lg py-3 flex flex-col items-center gap-1.5 bg-[#F8FAFC]">
                  <div className="w-4 h-4 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[12px] text-[#3B82F6] font-medium">Uploading...</span>
                </div>
              )}
              {(status === "uploaded" || status === "verified") && (
                <div className="flex items-center gap-2.5 p-2.5 bg-[#F8FAFC] rounded-lg">
                  <FileText size={14} className="text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-[#0F172A] truncate">{label.toLowerCase().replace(/[/ ]/g, "_")}.pdf</p>
                    <p className="text-[10px] text-slate-400">{status === "verified" ? "✓ Verified" : "Processing..."}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="bg-white rounded-xl border border-[#F1F5F9] p-5 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-[#0F172A]">Ready for analysis?</p>
          <p className="text-[11px] text-slate-400">Upload all required documents to generate your FRIE Score</p>
        </div>
        <button
          onClick={onAnalyze}
          disabled={!canAnalyze}
          className={`px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
            canAnalyze
              ? "bg-[#0F172A] text-white hover:bg-slate-800"
              : "bg-[#F8FAFC] text-slate-400 border border-[#F1F5F9] cursor-not-allowed"
          }`}
        >
          {canAnalyze ? "Analyze Documents →" : "Upload Required Docs"}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FINANCIAL ANALYSIS
// ═══════════════════════════════════════════════════════════════

function FinancialAnalysis({ features, onViewScore }: { features: CustomerFeatureMap | null; onViewScore: () => void }) {
  const [phase, setPhase] = useState<"processing" | "done">("processing");
  const [step, setStep]   = useState(0);

  const steps = [
    "Loading dataset record...",
    "Calculating income metrics...",
    "Analyzing credit behaviour...",
    "Computing FRIE Score...",
  ];

  useEffect(() => {
    if (phase !== "processing") return;
    const intervals = steps.map((_, i) =>
      setTimeout(() => setStep(i + 1), (i + 1) * 600)
    );
    const done = setTimeout(() => setPhase("done"), steps.length * 600 + 800);
    return () => { intervals.forEach(clearTimeout); clearTimeout(done); };
  }, []);

  if (phase === "processing") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[440px] bg-white rounded-xl border border-[#F1F5F9] p-12">
        <div className="w-14 h-14 border-4 border-[#0F172A] border-t-transparent rounded-full animate-spin mb-6" />
          <h2 className="text-[20px] font-extrabold text-[#0F172A] mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
            Analyzing Your Financials
          </h2>
          <p className="text-[14px] text-slate-500 text-center max-w-md">
            Processing the selected dataset record and calculating financial metrics.
          </p>
        <div className="mt-8 w-64 space-y-3">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2.5">
              {step > i ? (
                <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                  <Check size={9} className="text-white" />
                </div>
              ) : step === i ? (
                <div className="w-4 h-4 rounded-full border-2 border-[#3B82F6] border-t-transparent animate-spin shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0" />
              )}
              <p className={`text-[12px] ${step > i ? "text-emerald-600" : step === i ? "text-[#3B82F6]" : "text-slate-400"}`}>{s}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const metrics: { label: string; value: string; icon: React.ElementType; variant: string }[] = [
    { label: "Monthly Income",     value: fmtFeature(features, "monthly_income"),        icon: DollarSign,   variant: "green" },
    { label: "Monthly Expenses",   value: fmtFeature(features, "synthetic_total_expense"), icon: TrendingDown, variant: "red"   },
    { label: "Monthly Savings",    value: fmtFeature(features, "monthly_savings"),       icon: TrendingUp,   variant: "blue"  },
    { label: "Savings Balance",    value: fmtFeature(features, "savings_balance"),       icon: CreditCard,   variant: "amber" },
    { label: "Monthly EMI",        value: fmtFeature(features, "current_loan_annuity"),  icon: CreditCard,   variant: "amber" },
    { label: "Available Surplus",  value: fmtFeature(features, "available_surplus"),     icon: BarChart2,    variant: "blue"  },
    { label: "Savings Rate",       value: pctFeature(features, "savings_rate"),          icon: Percent,      variant: "green" },
    { label: "Debt-to-Income",     value: decimalFeature(features, "current_dti"),       icon: Activity,     variant: "red"   },
  ];

  const monthlyChartData = [
    { name: "Income",   value: Math.round((featureNumber(features, "monthly_income") ?? 0) / 1000),          fill: "#10B981" },
    { name: "Expenses", value: Math.round((featureNumber(features, "synthetic_total_expense") ?? 0) / 1000), fill: "#EF4444" },
    { name: "Savings",  value: Math.round((featureNumber(features, "monthly_savings") ?? 0) / 1000),         fill: "#3B82F6" },
    { name: "EMI",      value: Math.round((featureNumber(features, "current_loan_annuity") ?? 0) / 1000),    fill: "#F59E0B" },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle size={20} className="text-emerald-500 shrink-0" />
        <div>
          <p className="text-[14px] font-semibold text-emerald-800">Analysis Complete</p>
          <p className="text-[12px] text-emerald-600">Financial data processed. Review the metrics below.</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {metrics.map(({ label, value, icon, variant }) => (
          <Stat key={label} title={label} value={value} icon={icon} variant={variant} />
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#F1F5F9] p-6">
        <h3 className="text-[14px] font-bold text-[#0F172A] mb-4">Monthly Financial Breakdown</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyChartData} barSize={44}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}K`} />
            <Tooltip formatter={(v: number) => [`₹${v}K`, ""]} contentStyle={{ fontSize: 12, border: "1px solid #F1F5F9", borderRadius: 8, boxShadow: "none" }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {monthlyChartData.map((entry, i) => (
                <Cell key={`cell-${i}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#F8FAFC] border border-[#F1F5F9] rounded-xl p-4 flex items-start gap-3">
        <Info size={15} className="text-slate-400 mt-0.5 shrink-0" />
        <p className="text-[12px] text-slate-500">
          Prototype: Financial metrics are sourced from the local FRIE ML test record. The FRIE Score itself is produced by the saved research XGBoost pipeline for demonstration purposes and is not an externally validated real-world assessment.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onViewScore}
          className="bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-[14px] px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
        >
          View FRIE Score & Report <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRIE SCORE PAGE
// ═══════════════════════════════════════════════════════════════

function FRIEScorePage({ features, sampleId, prototypeScore }: { features: CustomerFeatureMap | null; sampleId: string | null; prototypeScore: PrototypeFrieScoreState }) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#0F172A] text-white">
          Dataset-backed prototype
        </span>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white border border-[#F1F5F9] text-slate-500">
          Prediction generated by FRIE XGBoost
        </span>
      </div>
      {/* Score header card */}
      <div className="bg-white rounded-xl border border-[#F1F5F9] p-8 flex items-center gap-8">
        {prototypeScore.status === "ready" ? (
          <ScoreGauge score={prototypeScore.frieScore} reliabilityLevel={prototypeScore.reliabilityLevel} size={195} />
        ) : (
          <PrototypeScorePanel state={prototypeScore} size={195} />
        )}
        <div className="flex-1">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">FRIE Score</p>
          {sampleId && (
            <p className="text-[11px] text-slate-400 mb-1">
              {sampleId.replace("frie-test-record-", "Prototype customer — record ")}
            </p>
          )}
          <p className="text-[52px] font-extrabold text-[#0F172A] leading-none" style={{ fontFamily: "Outfit, sans-serif" }}>
            {prototypeScore.status === "ready" ? prototypeScore.frieScore : "—"}
          </p>
          <p className="text-[14px] text-slate-500 mt-1.5">Financial Reliability Score — out of 100</p>
          <div className="flex items-center gap-2 mt-3">
            {prototypeScore.status === "ready" ? (
              <span className={`text-[12px] font-semibold px-3 py-1 rounded-full border ${reliabilityBadgeCls(prototypeScore.reliabilityLevel)}`}>
                {prototypeScore.reliabilityLevel}
              </span>
            ) : prototypeScore.status === "error" ? (
              <span className="text-[12px] font-semibold px-3 py-1 rounded-full border bg-red-50 text-red-700 border-red-100">
                Score unavailable
              </span>
            ) : (
              <span className="text-[12px] font-semibold px-3 py-1 rounded-full border bg-slate-50 text-slate-500 border-slate-100">
                Calculating FRIE Score...
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="bg-[#F8FAFC] rounded-lg p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Savings Rate</p>
              <p className="text-[18px] font-extrabold text-[#0F172A]" style={{ fontFamily: "Outfit, sans-serif" }}>{pctFeature(features, "savings_rate")}</p>
            </div>
            <div className="bg-[#F8FAFC] rounded-lg p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Debt-to-Income</p>
              <p className="text-[18px] font-extrabold text-[#0F172A]" style={{ fontFamily: "Outfit, sans-serif" }}>{decimalFeature(features, "current_dti")}</p>
            </div>
            <div className="bg-[#F8FAFC] rounded-lg p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Available Surplus</p>
              <p className="text-[18px] font-extrabold text-[#0F172A]" style={{ fontFamily: "Outfit, sans-serif" }}>{fmtFeature(features, "available_surplus")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#F8FAFC] border border-[#F1F5F9] rounded-xl p-4 flex items-start gap-3">
        <Info size={15} className="text-slate-400 mt-0.5 shrink-0" />
        <p className="text-[12px] text-slate-500">
          Prototype: The FRIE Score and reliability level are produced by the saved research XGBoost pipeline from the selected complete record of the local FRIE ML test dataset. Not an externally validated real-world financial-reliability assessment.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════

function RecommendationsPage() {
  const recs = [
    { cat: "Insurance",  priority: "High",   impact: "+8 pts", title: "Increase life insurance coverage", desc: "Your current coverage is insufficient relative to income and dependents. A term plan of ₹1Cr is recommended for comprehensive protection.", action: "Explore Plans" },
    { cat: "Investment", priority: "Medium", impact: "+5 pts", title: "Start a Systematic Investment Plan", desc: "No active SIP detected. Starting a ₹5,000/month SIP in a balanced mutual fund will improve your investment behaviour component.", action: "Get Started" },
    { cat: "Credit",     priority: "Medium", impact: "+4 pts", title: "Reduce credit card utilization below 30%", desc: "Your utilization is at 42%. Bringing it below 30% can improve your CIBIL score by 20–30 points within 3 months.", action: "Learn More" },
    { cat: "Savings",    priority: "Low",    impact: "+2 pts", title: "Move emergency fund to high-yield savings", desc: "Transfer your emergency corpus to a liquid mutual fund or high-yield account earning 6–7% vs 3.5% in a regular account.", action: "Compare Options" },
    { cat: "Debt",       priority: "Low",    impact: "+3 pts", title: "Make occasional home loan prepayments", desc: "1–2 extra EMI payments per year can reduce your loan tenure by 3–4 years and improve your debt burden score.", action: "Calculate Savings" },
  ];

  const prioColors: Record<string, string> = {
    High:   "bg-red-50 text-red-600 border-red-100",
    Medium: "bg-amber-50 text-amber-600 border-amber-100",
    Low:    "bg-emerald-50 text-emerald-600 border-emerald-100",
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="grid grid-cols-3 gap-4">
        {[
          { count: 1, label: "High Priority",   color: "text-red-500" },
          { count: 2, label: "Medium Priority",  color: "text-amber-500" },
          { count: 2, label: "Low Priority",     color: "text-emerald-500" },
        ].map(({ count, label, color }) => (
          <div key={label} className="bg-white rounded-xl border border-[#F1F5F9] p-4 text-center">
            <p className={`text-[28px] font-extrabold ${color}`} style={{ fontFamily: "Outfit, sans-serif" }}>{count}</p>
            <p className="text-[12px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {recs.map(({ cat, priority, impact, title, desc, action }) => (
        <div key={title} className="bg-white rounded-xl border border-[#F1F5F9] p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${prioColors[priority]}`}>{priority}</span>
              <span className="text-[11px] text-slate-400 font-medium">{cat}</span>
            </div>
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Impact: {impact}
            </span>
          </div>
          <h4 className="text-[14px] font-bold text-[#0F172A] mb-1.5">{title}</h4>
          <p className="text-[12px] text-slate-500 mb-3 leading-relaxed">{desc}</p>
          <button className="text-[12px] font-semibold text-[#3B82F6] hover:text-blue-700 flex items-center gap-1 transition-colors">
            {action} <ChevronRight size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════════════════════════

function HistoryPage() {
  const history = [
    { date: "Jul 25, 2025", score: 82, change: +1,  event: "Monthly reassessment" },
    { date: "Jun 25, 2025", score: 81, change: +3,  event: "Insurance document added" },
    { date: "May 25, 2025", score: 78, change: -1,  event: "Credit utilization increased" },
    { date: "Apr 25, 2025", score: 79, change: +3,  event: "SIP contributions detected" },
    { date: "Mar 25, 2025", score: 76, change: +2,  event: "Salary increment recorded" },
    { date: "Feb 25, 2025", score: 74, change: 0,   event: "Initial FRIE assessment" },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white rounded-xl border border-[#F1F5F9] p-6">
        <h3 className="text-[14px] font-bold text-[#0F172A] mb-4">Score History — Last 6 Months</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={SCORE_HISTORY}>
            <defs>
              <linearGradient id="hg1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#0F172A" stopOpacity={0.08} />
                <stop offset="95%" stopColor="#0F172A" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip contentStyle={{ fontSize: 12, border: "1px solid #F1F5F9", borderRadius: 8, boxShadow: "none" }} />
            <Area type="monotone" dataKey="score" stroke="#0F172A" strokeWidth={2} fill="url(#hg1)" dot={{ fill: "#0F172A", r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-[#F1F5F9] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F1F5F9]">
          <h3 className="text-[14px] font-bold text-[#0F172A]">Assessment Log</h3>
        </div>
        <div className="divide-y divide-[#F1F5F9]">
          {history.map(({ date, score, change, event }) => (
            <div key={date} className="px-6 py-4 flex items-center gap-4">
              <div className="w-28 shrink-0">
                <p className="text-[13px] font-bold text-[#0F172A]" style={{ color: scoreColor(score) }}>{score}</p>
                <p className="text-[10px] text-slate-400">{date}</p>
              </div>
              <div className="flex-1">
                <p className="text-[13px] text-slate-600">{event}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${scoreBadgeCls(score)}`}>
                  {scoreLabel(score)}
                </span>
                {change !== 0 && (
                  <span className={`text-[11px] font-bold flex items-center gap-0.5 ${change > 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {change > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                    {Math.abs(change)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BANK DASHBOARD
// ═══════════════════════════════════════════════════════════════

function BankDashboard({ onSelectCustomer }: { onSelectCustomer: (c: Customer) => void }) {
  const [search, setSearch] = useState("");
  const filtered = DEMO_CUSTOMERS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.id.toLowerCase().includes(search.toLowerCase())
  );
  const avgScore = Math.round(DEMO_CUSTOMERS.reduce((a, c) => a + c.frieScore, 0) / DEMO_CUSTOMERS.length);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Stat title="Total Customers"  value={DEMO_CUSTOMERS.length.toString()} sub="In portfolio"     icon={Users}          variant="blue"  />
        <Stat title="Avg. FRIE Score"  value={avgScore.toString()}              sub="Customer base"    icon={Star}           variant="green" />
        <Stat title="Low Risk"         value="1"                                sub="Score ≥ 70"       icon={Shield}         variant="green" />
        <Stat title="High Risk"        value="1"                                sub="Score < 55"       icon={AlertTriangle}  variant="red"   />
      </div>

      <div className="bg-white rounded-xl border border-[#F1F5F9] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-[#0F172A]">Customer FRIE Profiles</h3>
          <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#F1F5F9] rounded-lg px-3 py-2">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customers..."
              className="bg-transparent text-[13px] text-slate-600 placeholder:text-slate-400 outline-none w-36"
            />
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-[#F8FAFC]">
              {["Customer", "FRIE Score", "Category", "Credit Score", "Risk", "Debt-to-Income", ""].map((h, i) => (
                <th key={i} className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-[#F8FAFC] transition-colors">
                <td className="px-6 py-4">
                  <p className="text-[13px] font-semibold text-[#0F172A]">{c.name}</p>
                  <p className="text-[11px] text-slate-400">{c.id} · {c.occupation}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-[14px] font-extrabold" style={{ fontFamily: "Outfit, sans-serif", color: scoreColor(c.frieScore) }}>
                    {c.frieScore}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${scoreBadgeCls(c.frieScore)}`}>
                    {scoreLabel(c.frieScore)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <p className="text-[13px] font-semibold text-[#0F172A]">{c.creditScore}</p>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${riskBadgeCls(c.riskLevel)}`}>
                    {c.riskLevel}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <p className="text-[13px] font-semibold text-[#0F172A]">{c.debtToIncome.toFixed(2)}x</p>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => onSelectCustomer(c)}
                    className="text-[12px] font-semibold text-[#3B82F6] hover:text-blue-700 flex items-center gap-1 transition-colors"
                  >
                    View Profile <ChevronRight size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CUSTOMER PROFILE
// ═══════════════════════════════════════════════════════════════

function CustomerProfile({ customer, onBack }: { customer: Customer; onBack: () => void }) {
  const score = customer.frieScore;
  const loanDecision = score >= 70 ? "Recommend Approval" : score >= 55 ? "Manual Review Required" : "Not Recommended";
  const loanDecisionCls = score >= 70 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : score >= 55 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-red-700 bg-red-50 border-red-200";
  const loanDecisionIcon = score >= 70 ? <CheckCircle size={16} /> : score >= 55 ? <AlertTriangle size={16} /> : <XCircle size={16} />;

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-[#0F172A] font-semibold transition-colors">
        ← Back to Customers
      </button>

      <div className="bg-white rounded-xl border border-[#F1F5F9] p-6 flex items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-[#0F172A] flex items-center justify-center text-white text-[22px] font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>
          {customer.name.charAt(0)}
        </div>
        <div className="flex-1">
          <h2 className="text-[20px] font-extrabold text-[#0F172A]" style={{ fontFamily: "Outfit, sans-serif" }}>{customer.name}</h2>
          <p className="text-[13px] text-slate-500">{customer.occupation} · Age {customer.age} · {customer.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${riskBadgeCls(customer.riskLevel)}`}>{customer.riskLevel} Risk</span>
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${scoreBadgeCls(score)}`}>{scoreLabel(score)}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[38px] font-extrabold" style={{ fontFamily: "Outfit, sans-serif", color: scoreColor(score) }}>{score}</p>
          <p className="text-[12px] text-slate-400">FRIE Score</p>
          <p className="text-[11px] text-slate-400">{customer.confidence}% confidence</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Stat title="Monthly Income"  value={fmt(customer.monthlyIncome)}    icon={DollarSign}   variant="green" />
        <Stat title="Total Debt"      value={fmt(customer.existingDebt)}      icon={AlertTriangle}variant="amber" />
        <Stat title="CIBIL Score"     value={customer.creditScore.toString()} icon={CreditCard}   variant="blue"  />
        <Stat title="Savings Rate"    value={`${customer.savingsRate.toFixed(1)}%`} icon={TrendingUp} variant="blue" />
      </div>

      <div className="bg-white rounded-xl border border-[#F1F5F9] p-6">
        <h3 className="text-[14px] font-bold text-[#0F172A] mb-4">FRIE Component Breakdown</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          {Object.entries(customer.components).map(([k, v]) => {
            const meta = COMP_META[k];
            return meta ? <CompBar key={k} label={meta.label} score={v} icon={meta.icon} /> : null;
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#F1F5F9] p-6">
        <h3 className="text-[14px] font-bold text-[#0F172A] mb-4">Loan Decision Support</h3>
        <div className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[14px] font-bold ${loanDecisionCls}`}>
          {loanDecisionIcon}
          {loanDecision}
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-[#F8FAFC] rounded-lg p-3">
            <p className="text-[11px] text-slate-400">Recommended Loan</p>
            <p className="text-[15px] font-bold text-[#0F172A]">
              {score >= 70 ? fmt(customer.monthlyIncome * 50) : score >= 55 ? fmt(customer.monthlyIncome * 25) : "Not Eligible"}
            </p>
          </div>
          <div className="bg-[#F8FAFC] rounded-lg p-3">
            <p className="text-[11px] text-slate-400">Suggested Rate</p>
            <p className="text-[15px] font-bold text-[#0F172A]">
              {score >= 70 ? "8.5% p.a." : score >= 55 ? "10.5% p.a." : "N/A"}
            </p>
          </div>
          <div className="bg-[#F8FAFC] rounded-lg p-3">
            <p className="text-[11px] text-slate-400">Risk Classification</p>
            <p className="text-[15px] font-bold" style={{ color: customer.riskLevel === "Low" ? "#10B981" : customer.riskLevel === "Medium" ? "#F59E0B" : "#EF4444" }}>
              {customer.riskLevel} Risk
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NBFC DASHBOARD
// ═══════════════════════════════════════════════════════════════

function NBFCDashboard({ onSelectCustomer }: { onSelectCustomer: (c: Customer) => void }) {
  const applications = [
    { customer: DEMO_CUSTOMERS[1], amount: 500000, purpose: "Business Expansion", applied: "Jul 23, 2025", status: "Under Review"  },
    { customer: DEMO_CUSTOMERS[2], amount: 300000, purpose: "Personal Loan",       applied: "Jul 20, 2025", status: "High Risk"     },
    { customer: DEMO_CUSTOMERS[0], amount: 1000000,purpose: "Home Renovation",     applied: "Jul 15, 2025", status: "Pre-approved"  },
  ];

  const statusCls: Record<string, string> = {
    "Pre-approved": "bg-emerald-50 text-emerald-700 border-emerald-100",
    "Under Review": "bg-amber-50 text-amber-700 border-amber-100",
    "High Risk":    "bg-red-50 text-red-700 border-red-100",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Stat title="Applications"  value="3" sub="This month"        icon={Briefcase}     variant="blue"  />
        <Stat title="Pre-approved"  value="1" sub="Ready to disburse" icon={CheckCircle}   variant="green" />
        <Stat title="Under Review"  value="1" sub="Manual check"      icon={AlertTriangle} variant="amber" />
        <Stat title="High Risk"     value="1" sub="Not recommended"   icon={XCircle}       variant="red"   />
      </div>

      <div className="bg-white rounded-xl border border-[#F1F5F9] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F1F5F9]">
          <h3 className="text-[14px] font-bold text-[#0F172A]">Loan Applications</h3>
        </div>
        <div className="divide-y divide-[#F1F5F9]">
          {applications.map(({ customer, amount, purpose, applied, status }) => (
            <div key={customer.id} className="px-6 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#F8FAFC] border border-[#F1F5F9] flex items-center justify-center text-[14px] font-bold text-[#0F172A] shrink-0">
                {customer.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-[#0F172A]">{customer.name}</p>
                <p className="text-[11px] text-slate-400">{purpose} · Applied {applied}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-bold text-[#0F172A]">{fmt(amount)}</p>
                <p className="text-[10px] text-slate-400">Requested</p>
              </div>
              <div className="text-right shrink-0 w-16">
                <p className="text-[14px] font-extrabold" style={{ fontFamily: "Outfit, sans-serif", color: scoreColor(customer.frieScore) }}>
                  {customer.frieScore}
                </p>
                <p className="text-[10px] text-slate-400">FRIE</p>
              </div>
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${statusCls[status]}`}>
                {status}
              </span>
              <button
                onClick={() => onSelectCustomer(customer)}
                className="text-[12px] font-semibold text-[#3B82F6] hover:text-blue-700 flex items-center gap-1 shrink-0 transition-colors"
              >
                Review <ChevronRight size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RiskPage({ onSelectCustomer }: { onSelectCustomer: (c: Customer) => void }) {
  return (
    <div className="grid grid-cols-3 gap-5">
      {DEMO_CUSTOMERS.map(c => (
        <div key={c.id} className="bg-white rounded-xl border border-[#F1F5F9] p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[14px] font-bold text-[#0F172A]">{c.name}</p>
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${riskBadgeCls(c.riskLevel)}`}>
              {c.riskLevel}
            </span>
          </div>
          <div className="flex items-end justify-between mb-4">
            <p className="text-[32px] font-extrabold" style={{ fontFamily: "Outfit, sans-serif", color: scoreColor(c.frieScore) }}>
              {c.frieScore}
            </p>
            <p className="text-[11px] text-slate-400 mb-1.5">FRIE Score</p>
          </div>
          <div className="space-y-2 mb-4">
            {[
              { label: "Debt-to-Income", value: `${c.debtToIncome.toFixed(2)}x`, warn: c.debtToIncome > 3 },
              { label: "Savings Rate",   value: `${c.savingsRate.toFixed(1)}%`,   warn: c.savingsRate < 20 },
              { label: "CIBIL Score",    value: c.creditScore.toString(),          warn: c.creditScore < 650 },
            ].map(({ label, value, warn }) => (
              <div key={label} className="flex items-center justify-between">
                <p className="text-[12px] text-slate-500">{label}</p>
                <p className={`text-[12px] font-semibold ${warn ? "text-red-500" : "text-emerald-600"}`}>{value}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => onSelectCustomer(c)}
            className="w-full py-2 bg-[#F8FAFC] border border-[#F1F5F9] rounded-lg text-[12px] font-semibold text-[#0F172A] hover:bg-slate-100 transition-colors"
          >
            View Full Profile
          </button>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INSURANCE DASHBOARD
// ═══════════════════════════════════════════════════════════════

function InsuranceDashboard({ onSelectCustomer }: { onSelectCustomer: (c: Customer) => void }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Stat title="Customers"      value={DEMO_CUSTOMERS.length.toString()} sub="In portfolio"      icon={Users}          variant="blue"  />
        <Stat title="High Stability" value="1"                                sub="Score ≥ 75"        icon={Shield}         variant="green" />
        <Stat title="Needs Coverage" value="2"                                sub="Insurance < 70"   icon={Heart}          variant="amber" />
        <Stat title="High Risk"      value="1"                                sub="Score < 55"        icon={AlertTriangle}  variant="red"   />
      </div>

      <div className="grid grid-cols-3 gap-5">
        {DEMO_CUSTOMERS.map(c => {
          const ins = c.components.insuranceProtection;
          const insCls = ins < 50 ? "bg-red-50 text-red-700" : ins < 70 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";
          const insMsg = ins < 50 ? "⚠ Critically underinsured" : ins < 70 ? "Coverage gap detected" : "Adequate coverage";
          return (
            <div key={c.id} className="bg-white rounded-xl border border-[#F1F5F9] p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#0F172A] flex items-center justify-center text-white font-bold shrink-0">
                  {c.name.charAt(0)}
                </div>
                <div>
                  <p className="text-[14px] font-bold text-[#0F172A]">{c.name}</p>
                  <p className="text-[11px] text-slate-400">{c.occupation} · Age {c.age}</p>
                </div>
              </div>
              <div className="mb-4">
                <p className="text-[11px] text-slate-400 mb-1">FRIE Score</p>
                <div className="flex items-center gap-2">
                  <p className="text-[28px] font-extrabold" style={{ fontFamily: "Outfit, sans-serif", color: scoreColor(c.frieScore) }}>
                    {c.frieScore}
                  </p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${scoreBadgeCls(c.frieScore)}`}>
                    {scoreLabel(c.frieScore)}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5 mb-4">
                {[
                  { label: "Monthly Income",      value: fmt(c.monthlyIncome) },
                  { label: "Insurance Score",     value: `${ins}/100`,  colored: true, warn: ins < 70 },
                  { label: "Financial Resilience",value: `${c.components.financialResilience}/100` },
                  { label: "Savings Rate",        value: `${c.savingsRate.toFixed(1)}%` },
                ].map(({ label, value, colored, warn }) => (
                  <div key={label} className="flex items-center justify-between">
                    <p className="text-[12px] text-slate-500">{label}</p>
                    <p className={`text-[12px] font-semibold ${colored ? (warn ? "text-red-500" : "text-emerald-600") : "text-[#0F172A]"}`}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              <div className={`text-[11px] font-semibold p-2.5 rounded-lg mb-3 ${insCls}`}>
                {insMsg}
              </div>
              <button
                onClick={() => onSelectCustomer(c)}
                className="w-full py-2 bg-[#F8FAFC] border border-[#F1F5F9] rounded-lg text-[12px] font-semibold text-[#0F172A] hover:bg-slate-100 transition-colors"
              >
                Full Profile
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHARED PAGES
// ═══════════════════════════════════════════════════════════════

function ReportsPage() {
  return (
    <div className="space-y-5 max-w-3xl">
      <div className="grid grid-cols-2 gap-5">
        {[
          { title: "Individual FRIE Report",   desc: "Comprehensive financial reliability assessment for Priya Sharma",   date: "Jul 25, 2025", icon: FileText },
          { title: "Monthly Portfolio Report", desc: "Aggregated FRIE metrics and trends across all customers",            date: "Jul 1,  2025", icon: BarChart2 },
          { title: "Risk Assessment Report",   desc: "High-risk customer identification and detailed analysis",            date: "Jun 25, 2025", icon: AlertTriangle },
          { title: "Trend Analysis Report",    desc: "Score movement and financial behaviour patterns — last quarter",    date: "Jun 1,  2025", icon: TrendingUp },
        ].map(({ title, desc, date, icon: Icon }) => (
          <div key={title} className="bg-white rounded-xl border border-[#F1F5F9] p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 bg-[#F8FAFC] rounded-lg flex items-center justify-center shrink-0">
                <Icon size={16} className="text-slate-500" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#0F172A]">{title}</p>
                <p className="text-[11px] text-slate-400">{date}</p>
              </div>
            </div>
            <p className="text-[12px] text-slate-500 mb-3">{desc}</p>
            <button className="flex items-center gap-1.5 text-[12px] font-semibold text-[#3B82F6] hover:text-blue-700 transition-colors">
              <Download size={13} /> Download PDF
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfilePage({ user }: { user: AuthUser }) {
  return (
    <div className="space-y-5 max-w-2xl">
      <div className="bg-white rounded-xl border border-[#F1F5F9] p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-full bg-[#0F172A] flex items-center justify-center text-white text-[22px] font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>
            {user.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-[20px] font-extrabold text-[#0F172A]" style={{ fontFamily: "Outfit, sans-serif" }}>{user.name}</h2>
            <p className="text-[13px] text-slate-500">{user.email}</p>
            <span className="inline-block mt-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#0F172A] text-white capitalize">
              {user.role} Portal
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Email",         value: user.email },
            { label: "Portal Type",   value: `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}` },
            { label: "Account Status",value: "Active" },
            { label: "Member Since",  value: "January 2025" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#F8FAFC] rounded-lg p-3">
              <p className="text-[11px] text-slate-400 mb-0.5">{label}</p>
              <p className="text-[13px] font-semibold text-[#0F172A]">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsPage() {
  const [notifs,   setNotifs]   = useState(true);
  const [alerts,   setAlerts]   = useState(true);
  const [reports,  setReports]  = useState(false);

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="bg-white rounded-xl border border-[#F1F5F9] p-6">
        <h3 className="text-[14px] font-bold text-[#0F172A] mb-4">Notification Preferences</h3>
        <div className="space-y-1">
          {[
            { label: "Push Notifications",   desc: "Receive in-app notifications",           checked: notifs,  toggle: () => setNotifs(!notifs) },
            { label: "FRIE Score Alerts",    desc: "Alert when score changes by ±5 points",  checked: alerts,  toggle: () => setAlerts(!alerts) },
            { label: "Monthly Reports",      desc: "Receive monthly financial summary email",checked: reports, toggle: () => setReports(!reports) },
          ].map(({ label, desc, checked, toggle }) => (
            <div key={label} className="flex items-center justify-between py-3.5 border-b border-[#F1F5F9] last:border-0">
              <div>
                <p className="text-[13px] font-semibold text-[#0F172A]">{label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
              </div>
              <Toggle checked={checked} onChange={toggle} />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-[#F1F5F9] p-6">
        <h3 className="text-[14px] font-bold text-[#0F172A] mb-4">Security</h3>
        <button className="w-full py-3 bg-[#F8FAFC] border border-[#F1F5F9] rounded-lg text-[13px] font-semibold text-[#0F172A] hover:bg-slate-100 transition-colors text-left px-4">
          Change Password →
        </button>
      </div>
    </div>
  );
}

function NotificationsPage() {
  const items = [
    { title: "FRIE Score Updated to 82",      desc: "Your score increased by +1 from last month",             time: "2 hours ago", read: false, icon: Star,        bg: "bg-blue-50",    ic: "text-blue-500"    },
    { title: "Document Verified",              desc: "Bank Statement successfully verified",                    time: "Yesterday",   read: false, icon: CheckCircle, bg: "bg-emerald-50", ic: "text-emerald-500" },
    { title: "New Recommendation",             desc: "New insurance coverage recommendation available",         time: "2 days ago",  read: true,  icon: MessageSquare,bg: "bg-slate-100",  ic: "text-slate-500"   },
    { title: "Monthly Report Ready",           desc: "Your June 2025 financial report is ready to download",   time: "1 week ago",  read: true,  icon: FileText,    bg: "bg-slate-100",  ic: "text-slate-500"   },
  ];

  return (
    <div className="space-y-2 max-w-2xl">
      {items.map(({ title, desc, time, read, icon: Icon, bg, ic }) => (
        <div key={title} className={`bg-white rounded-xl border p-4 flex items-start gap-3 ${read ? "border-[#F1F5F9]" : "border-blue-100"}`}>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${read ? "bg-slate-100" : bg}`}>
            <Icon size={15} className={read ? "text-slate-400" : ic} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className={`text-[13px] font-semibold ${read ? "text-slate-600" : "text-[#0F172A]"}`}>{title}</p>
              {!read && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
            </div>
            <p className="text-[12px] text-slate-400 mt-0.5">{desc}</p>
            <p className="text-[11px] text-slate-300 mt-1">{time}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const [user,             setUser]             = useState<AuthUser | null>(null);
  const [view,             setView]             = useState<View>("select-customer");
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const prototypeScore = usePrototypeFrieScore(selectedSampleId);

  function handleLogin(u: AuthUser) {
    setUser(u);
    setSelectedSampleId(null);
    setView("select-customer");
  }
  function handleLogout() {
    setUser(null);
    setView("select-customer");
    setSelectedSampleId(null);
  }
  function navigate(v: View) {
    setView(v);
  }
  function selectRecord(sampleId: string) {
    setSelectedSampleId(sampleId);
    setView("dashboard");
  }

  if (!user) return <LoginPage onLogin={handleLogin} />;

  const prototypeFeatures = prototypeScore.status === "ready" ? prototypeScore.features : null;

  function renderContent(): React.ReactNode {
    if (!user) return null;
    switch (view) {
      case "select-customer":
        return <CustomerSelector selectedId={selectedSampleId} onSelect={selectRecord} />;
      case "dashboard":
        if (!selectedSampleId) return <CustomerSelector selectedId={selectedSampleId} onSelect={selectRecord} />;
        return <IndividualDashboard features={prototypeFeatures} sampleId={selectedSampleId} onNavigate={navigate} prototypeScore={prototypeScore} />;
      case "score":
        if (!selectedSampleId) return <CustomerSelector selectedId={selectedSampleId} onSelect={selectRecord} />;
        return <FRIEScorePage features={prototypeFeatures} sampleId={selectedSampleId} prototypeScore={prototypeScore} />;
      case "analysis":
        if (!selectedSampleId) return <CustomerSelector selectedId={selectedSampleId} onSelect={selectRecord} />;
        return <FinancialAnalysis features={prototypeFeatures} onViewScore={() => navigate("score")} />;
      default:
        return null;
    }
  }

  return (
    <AppLayout
      role={user.role}
      view={view}
      onNavigate={navigate}
      onLogout={handleLogout}
      userName={user.name}
    >
      {renderContent()}
    </AppLayout>
  );
}
