package com.app.service

import com.app.entity.User
import com.app.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class UserService(
    private val userRepository: UserRepository
) {

    fun findById(id: Long): User? {
        return userRepository.findById(id).orElse(null)
    }

    fun findByEmail(email: String): User? {
        return userRepository.findByEmail(email).orElse(null)
    }

    fun createUser(email: String, name: String, password: String): User {
        if (userRepository.existsByEmail(email)) {
            throw IllegalArgumentException("User with email $email already exists")
        }

        val user = User(
            email = email,
            name = name,
            password = password, // TODO: Hash password with BCrypt
            enabled = true
        )

        return userRepository.save(user)
    }

    fun updateUser(id: Long, name: String): User {
        val user = findById(id) ?: throw IllegalArgumentException("User not found")
        user.name = name
        return userRepository.save(user)
    }

    fun deleteUser(id: Long) {
        userRepository.deleteById(id)
    }
}
