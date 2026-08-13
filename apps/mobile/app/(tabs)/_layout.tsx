import { colors, luxyColors, spacing } from '@myfan/ui';
import { Redirect, Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LuxyShellNavigation } from '@/components/luxy-shell-navigation';
import { getAuthenticatedDestination } from '@/lib/auth';
import type { AuthenticatedRoute } from '@/lib/auth-routing';
import { logger } from '@/lib/logger';
import { useAuth } from '@/providers/auth-provider';
export default function AuthenticatedLuxyLayout(){const auth=useAuth();const[destination,setDestination]=useState<AuthenticatedRoute|null>(null);useEffect(()=>{if(auth.isRestoring||!auth.userId)return;let active=true;void getAuthenticatedDestination().then(route=>{if(active)setDestination(route)}).catch(error=>{logger.error('Unable to authorize protected Chon.Love routes',error);if(active)setDestination('/(onboarding)')});return()=>{active=false}},[auth.isRestoring,auth.userId]);if(auth.isRestoring)return<RouteLoading/>;if(!auth.userId)return<Redirect href="/"/>;if(destination===null)return<RouteLoading/>;if(destination!=='/(tabs)')return<Redirect href="/(onboarding)"/>;return <View style={styles.shell}><LuxyShellNavigation/><View style={styles.routeContent}><Slot/></View></View>}
function RouteLoading(){return <View style={styles.loading}><ActivityIndicator accessibilityLabel="Đang tải" accessibilityRole="progressbar" color={colors.primary} size="large"/><Text accessibilityLiveRegion="polite" style={styles.loadingText}>Đang kiểm tra quyền truy cập…</Text></View>}
const styles=StyleSheet.create({shell:{backgroundColor:luxyColors.background,flex:1},routeContent:{backgroundColor:luxyColors.background,flex:1,minHeight:0},loading:{alignItems:'center',backgroundColor:luxyColors.background,flex:1,gap:spacing.md,justifyContent:'center'},loadingText:{color:colors.muted,fontSize:14}});
