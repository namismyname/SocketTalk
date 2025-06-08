
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { User as UserIcon, LogIn, UserPlus, Lock, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { AuthJoinResponse, RegisterUserResponse, LoginFailedResponse } from '@/types';

type AuthMode = 'login' | 'register';

interface AuthFormProps {
  onAuthSuccess: (response: AuthJoinResponse) => void;
  socket: any; 
  isConnected: boolean;
}

const LOGIN_TIMEOUT_MS = 15000; // 15 seconds

export function AuthForm({ onAuthSuccess, socket, isConnected }: AuthFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const isLoadingRef = useRef(isLoading);
  const loginAttemptTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    if (!socket) {
      console.log("AuthForm: Socket instance not available for setting up listeners.");
      return;
    }

    console.log("AuthForm: useEffect - Setting up event listeners.");

    const handleLoginAttemptAcknowledged = (data: any) => {
      console.log("AuthForm: Received 'login_attempt_acknowledged'. Data:", data);
      // This is purely for debugging, does not change loading state.
    };

    const handleLoginSuccess = (response: AuthJoinResponse) => {
      console.log("AuthForm: Received 'login_success'. Response:", response);
      if (loginAttemptTimerRef.current) {
        clearTimeout(loginAttemptTimerRef.current);
        loginAttemptTimerRef.current = null;
      }
      setIsLoading(false);
      if (response.success && response.currentUserId && response.users && response.username) {
        onAuthSuccess(response);
      } else {
        setError(response.error || "Login successful but session data incomplete.");
      }
    };

    const handleLoginFailed = (response: LoginFailedResponse) => {
      console.log("AuthForm: Received 'login_failed'. Response:", response);
      if (loginAttemptTimerRef.current) {
        clearTimeout(loginAttemptTimerRef.current);
        loginAttemptTimerRef.current = null;
      }
      setIsLoading(false);
      setError(response.message || "Login failed. Please check your credentials or register.");
    };
    
    const handleDisconnect = (reason: string) => {
      console.warn(`AuthForm: Socket disconnected during auth flow. Reason: ${reason}. Was loading: ${isLoadingRef.current}`);
      if (isLoadingRef.current) { 
        if (loginAttemptTimerRef.current) {
          clearTimeout(loginAttemptTimerRef.current);
          loginAttemptTimerRef.current = null;
        }
        setIsLoading(false);
        setError("Connection lost. Please try again.");
      }
    };

    socket.on('login_attempt_acknowledged', handleLoginAttemptAcknowledged);
    socket.on('login_success', handleLoginSuccess);
    socket.on('login_failed', handleLoginFailed);
    socket.on('disconnect', handleDisconnect);

    return () => {
      console.log("AuthForm: useEffect cleanup - Removing event listeners.");
      socket.off('login_attempt_acknowledged', handleLoginAttemptAcknowledged);
      socket.off('login_success', handleLoginSuccess);
      socket.off('login_failed', handleLoginFailed);
      socket.off('disconnect', handleDisconnect);
      if (loginAttemptTimerRef.current) {
        clearTimeout(loginAttemptTimerRef.current);
        loginAttemptTimerRef.current = null;
      }
    };
  }, [socket, onAuthSuccess]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(`AuthForm: Submitting form. Mode: ${authMode}. Socket connected: ${isConnected}`);
    if (!username.trim() || !password.trim() || isLoading) return;

    if (!socket || !isConnected) {
      setError("Not connected to chat server. Please wait.");
      console.warn("AuthForm: handleSubmit called but socket not connected or instance unavailable.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (loginAttemptTimerRef.current) {
      clearTimeout(loginAttemptTimerRef.current);
    }

    const credentials = { username: username.trim(), password };

    if (authMode === 'register') {
      console.log("AuthForm: Emitting 'register_user' with credentials:", credentials);
      socket.emit('register_user', credentials, (response: RegisterUserResponse) => {
        console.log("AuthForm: Received callback for 'register_user'. Response:", response);
        setIsLoading(false); 
        if (response.success) {
          setSuccessMessage((response.message || "Registration successful!") + " Please log in.");
          setAuthMode('login'); 
          setPassword(''); 
        } else {
          setError(response.message || "Registration failed.");
        }
      });
    } else { 
      console.log("AuthForm: Emitting 'login_user' with credentials:", credentials);
      socket.emit('login_user', credentials); 
      
      loginAttemptTimerRef.current = setTimeout(() => {
        if (isLoadingRef.current) { // Check if still loading
          console.warn("AuthForm: Login attempt timed out.");
          setIsLoading(false);
          setError("Login attempt timed out. The server might be unresponsive or the connection is unstable. Please try again.");
        }
        loginAttemptTimerRef.current = null;
      }, LOGIN_TIMEOUT_MS);
    }
  };

  const toggleAuthMode = () => {
    setAuthMode(prevMode => prevMode === 'login' ? 'register' : 'login');
    setError(null);
    setSuccessMessage(null);
    setPassword(''); 
    setUsername(''); 
  };
  
  const cardTitle = authMode === 'login' ? "Login to SocketTalk" : "Register for SocketTalk";
  const cardDescription = authMode === 'login' ? "Enter your credentials to chat." : "Create an account to join the chat.";
  const submitButtonText = authMode === 'login' ? "Login" : "Register";
  const toggleButtonText = authMode === 'login' ? "Need an account? Register" : "Already have an account? Login";
  const TitleIcon = authMode === 'login' ? LogIn : UserPlus;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center justify-center text-2xl font-headline">
            <TitleIcon className="w-8 h-8 mr-2 text-primary" />
            {cardTitle}
          </CardTitle>
          <CardDescription className="text-center">
            {cardDescription}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {successMessage && (
              <Alert variant="default" className="bg-green-100 border-green-300 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-300">
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError(null);
                  if (successMessage) setSuccessMessage(null);
                }}
                className="text-base pl-10"
                aria-label="Username"
                required
                disabled={isLoading}
              />
            </div>
             <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                   if (successMessage) setSuccessMessage(null);
                }}
                className="text-base pl-10"
                aria-label="Password"
                required
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full text-lg" disabled={!username.trim() || !password.trim() || isLoading || !isConnected}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {authMode === 'login' ? "Logging in..." : "Registering..."}
                </>
              ) : (
                submitButtonText
              )}
            </Button>
            {!isConnected && !isLoading && <p className="text-xs text-destructive text-center">Disconnected. Attempting to reconnect...</p>}
            {!isConnected && isLoading && <p className="text-xs text-destructive text-center">Connection lost during operation. Please wait or try again.</p>}
            <Button variant="link" type="button" onClick={toggleAuthMode} disabled={isLoading}>
              {toggleButtonText}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export { AuthForm as UsernamePrompt };

    
