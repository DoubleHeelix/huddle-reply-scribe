
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

interface LandingPageProps {
  onGetStarted: () => void;
}

const LandingPage = ({ onGetStarted }: LandingPageProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 flex items-center justify-center relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
        {/* Logo/Icon */}
        <div className="mb-8 animate-fade-in">
          <div className="w-20 h-20 mx-auto bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mb-6 animate-scale-in">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Animated title */}
        <div className="mb-8 space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent animate-pulse">
              Huddle
            </span>
            <span className="block text-3xl md:text-4xl mt-2 text-gray-300 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              Assistant
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto leading-relaxed animate-fade-in" style={{ animationDelay: '0.6s' }}>
            AI-powered conversation suggestions that help you communicate with 
            <span className="text-purple-400 font-semibold"> clarity</span>,
            <span className="text-blue-400 font-semibold"> connection</span>, and
            <span className="text-pink-400 font-semibold"> empathy</span>
          </p>
        </div>

        {/* Features list */}
        <div className="mb-12 grid md:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '0.8s' }}>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto bg-purple-500/20 rounded-lg flex items-center justify-center mb-3">
              <span className="text-2xl">📸</span>
            </div>
            <h3 className="text-white font-semibold mb-2">Upload Screenshot</h3>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto bg-blue-500/20 rounded-lg flex items-center justify-center mb-3">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="text-white font-semibold mb-2">AI Suggestions</h3>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto bg-pink-500/20 rounded-lg flex items-center justify-center mb-3">
              <span className="text-2xl">⚡</span>
            </div>
            <h3 className="text-white font-semibold mb-2">Instant Results</h3>
          </div>
        </div>

        {/* Get Started Button */}
        <div className="animate-fade-in" style={{ animationDelay: '1s' }}>
          <Button
            onClick={onGetStarted}
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-2xl hover:shadow-purple-500/25 transition-all duration-300 hover:scale-105 group"
          >
            Get Started
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
