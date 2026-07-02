package com.flowcheck.service;

import com.flowcheck.domain.Post;
import com.flowcheck.dto.PostRequest;
import com.flowcheck.dto.PostResponse;
import com.flowcheck.repository.PostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PostService {

    private final PostRepository postRepository;

    public List<PostResponse> findAll() {
        return postRepository.findAll()
                .stream()
                .map(PostResponse::from)
                .toList();
    }

    public PostResponse findById(Long id) {
        Post post = postRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("게시글을 찾을 수 없습니다."));

        return PostResponse.from(post);
    }

    public PostResponse create(PostRequest request) {
        Post post = Post.builder()
                .title(request.getTitle())
                .content(request.getContent())
                .writer(request.getWriter())
                .build();

        Post savedPost = postRepository.save(post);

        return PostResponse.from(savedPost);
    }

    public PostResponse update(Long id, PostRequest request) {
        Post post = postRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("게시글을 찾을 수 없습니다."));

        post.setTitle(request.getTitle());
        post.setContent(request.getContent());

        Post updatedPost = postRepository.save(post);

        return PostResponse.from(updatedPost);
    }

    public void delete(Long id) {
        postRepository.deleteById(id);
    }
}