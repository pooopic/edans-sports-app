package com.tamlili.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument

@Composable
fun AppNav(openCallId: Long?, onCallOpened: () -> Unit) {
    val nav = rememberNavController()

    LaunchedEffect(openCallId) {
        if (openCallId != null) {
            nav.navigate("call/$openCallId")
            onCallOpened()
        }
    }

    NavHost(navController = nav, startDestination = "home") {
        composable("home") {
            HomeScreen(
                onOpenCall = { nav.navigate("call/$it") },
                onOpenPermissions = { nav.navigate("permissions") },
                onOpenDiagnostics = { nav.navigate("diagnostics") },
            )
        }
        composable("permissions") { PermissionsScreen(onBack = { nav.popBackStack() }) }
        composable("diagnostics") { DiagnosticsScreen(onBack = { nav.popBackStack() }) }
        composable(
            "call/{id}", arguments = listOf(navArgument("id") { type = NavType.LongType })
        ) { entry ->
            CallDetailScreen(
                callId = entry.arguments?.getLong("id") ?: 0L,
                onBack = { nav.popBackStack() },
            )
        }
    }
}
