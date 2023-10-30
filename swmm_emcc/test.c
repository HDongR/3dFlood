#include <omp.h>
#include <stdio.h>
void d();
int main()
{
	printf("hello, world!\n");
   
	d();
	return 0;
}


void d(){
	#pragma omp parallel
	{
		      
		printf("num_threads = %d\n", omp_get_num_threads());
	}
}
