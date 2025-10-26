package com.app.controller

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/users")
class UserController {

    @GetMapping("/me")
    fun getCurrentUser(): ResponseEntity<UserResponse> {
        // TODO: Replace with actual authenticated user from JWT
        return ResponseEntity.ok(
            UserResponse(
                id = 1,
                email = "user@example.com",
                name = "Demo User"
            )
        )
    }
}

data class UserResponse(
    val id: Long,
    val email: String,
    val name: String
)
