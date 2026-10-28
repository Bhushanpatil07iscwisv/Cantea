import { formatClock } from '../time'
import React from 'react'
import { motion } from 'motion/react'
import { Clock, ArrowRight, CheckCircle2 } from 'lucide-react'
import type { SlotsInfo } from '../types'


interface HeroProps {
  onOrderClick: () => void
  slotsInfo: SlotsInfo | null
}

export const Hero: React.FC<HeroProps> = ({ onOrderClick, slotsInfo }) => {
  return (
    <section className="relative overflow-hidden pt-8 pb-12 sm:pt-12 sm:pb-16 bg-radial from-[#F5F1E6] to-[#FBF9F4]">
      {/* Subtle organic background glow accents */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#1B5747]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-[#E07A5F]/8 rounded-full blur-2xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Main Hero Copy */}
          <div className="lg:col-span-7 text-center lg:text-left">
            {/* Pill tag */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E2DBD0] text-[#1B5747] text-xs font-bold shadow-2xs mb-5"
            >
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>College Canteen Pre-order & Token System</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#162B23] leading-[1.12]"
            >
              Your break deserves <br className="hidden sm:inline" />
              <span className="text-[#1B5747] underline decoration-[#E07A5F]/40 decoration-wavy decoration-2">
                better than a queue.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="mt-4 sm:mt-5 text-base sm:text-lg text-[#556961] max-w-2xl mx-auto lg:mx-0 font-normal leading-relaxed"
            >
              Order your favorite breakfast, thali, snacks and drinks ahead of time. Choose a 15-minute pickup window, get an instant digital token, and collect your hot meal the moment you arrive.
            </motion.p>

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 }}
              className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4"
            >
              <button
                onClick={onOrderClick}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#1B5747] hover:bg-[#144236] text-white font-bold text-base shadow-sm hover:shadow-md flex items-center justify-center gap-2 transition-all group focus:outline-none"
              >
                <span>Browse Menu & Order</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              {slotsInfo && (
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#3C4F47] px-4 py-3 rounded-xl bg-white/70 border border-[#E8E2D5]">
                  <Clock className="w-4 h-4 text-[#1B5747]" />
                  <span>
                    Hours: {formatClock(slotsInfo.open_time)} – {formatClock(slotsInfo.close_time)} IST
                  </span>
                </div>
              )}
            </motion.div>

            {/* Feature Value Props Checklist */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="mt-8 pt-6 border-t border-[#E8E2D5] grid grid-cols-2 sm:grid-cols-4 gap-3 text-left"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#1B5747] shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-[#2C3E36]">Instant Token</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#1B5747] shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-[#2C3E36]">15-Min Slots</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#1B5747] shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-[#2C3E36]">Live Kitchen Queue</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#1B5747] shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-[#2C3E36]">Counter or Online</span>
              </div>
            </motion.div>
          </div>

          {/* Hero Visual Card / Quick Preview */}
          <div className="lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="relative mx-auto max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-md border border-[#E2DBD0]"
            >
              {/* Token Card Preview Mockup */}
              <div className="bg-[#1B5747] rounded-2xl p-5 text-white shadow-inner relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/15 pb-3">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-white/70 font-bold block">
                      Sample Pickup Token
                    </span>
                    <span className="text-2xl font-black tracking-tight text-white font-mono">
                      CT-849A2
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] uppercase tracking-wider text-white/70 font-semibold block">
                      Collection Code
                    </span>
                    <span className="text-xl font-black text-[#E07A5F] bg-white/10 px-2 py-0.5 rounded font-mono">
                      E94
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-white/90">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#E07A5F]" />
                    <span>Pickup: 1:15 PM – 1:30 PM IST</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[11px]">
                    Ready for Pickup
                  </span>
                </div>
              </div>

              {/* Quick sample meal items preview */}
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF8F2] border border-[#EFEAE0]">
                  <div className="flex items-center gap-3">
                    <img
                      src="https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=100&auto=format&fit=crop&q=80"
                      alt="Poha"
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-[#1F3028]">Hot Spiced Poha</h4>
                      <p className="text-xs text-[#70807A]">Breakfast • Fresh coriander & lemon</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-[#1B5747]">₹30.00</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF8F2] border border-[#EFEAE0]">
                  <div className="flex items-center gap-3">
                    <img
                      src="https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=100&auto=format&fit=crop&q=80"
                      alt="Masala Chai"
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-[#1F3028]">Masala Kulhad Chai</h4>
                      <p className="text-xs text-[#70807A]">Drinks • Ginger & cardamom</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-[#1B5747]">₹15.00</span>
                </div>
              </div>

              {/* Status summary banner */}
              <div className="mt-4 pt-3 border-t border-[#ECE5D8] flex items-center justify-between text-xs text-[#52645E]">
                <span>⚡ Real-time token generation</span>
                <span className="font-bold text-[#1B5747]">Zero Waiting In Line</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
